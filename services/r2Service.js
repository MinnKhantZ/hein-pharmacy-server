const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const WorkerProxyService = require('./WorkerProxyService');

const IMAGE_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif'
};

function ensureR2Config() {
  const requiredKeys = [
    'R2_REGION',
    'R2_BUCKET',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_PUBLIC_BASE_URL'
  ];

  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing R2 configuration: ${missing.join(', ')}`);
  }
}

function getR2Client() {
  ensureR2Config();

  return new S3Client({
    region: process.env.R2_REGION,
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

function buildInvoiceImageKey(originalName, mimetype) {
  const envFolder = process.env.NODE_ENV || 'development';
  const extension = IMAGE_EXTENSION_BY_MIME[mimetype] || 'jpg';
  const safeName = (originalName || 'invoice')
    .split('.')
    .slice(0, -1)
    .join('.')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'invoice';
  const randomId = crypto.randomUUID();

  return `${envFolder}/invoices/${Date.now()}-${randomId}-${safeName}.${extension}`;
}

function buildPublicUrl(key) {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${baseUrl}/${key}`;
}

/**
 * Extract the R2 object key from an image_url value.
 * Handles both full URLs (https://pharmacy-bucket.minkhantzaw.dev/env/invoices/...)
 * and plain keys (env/invoices/...).
 */
function extractKeyFromImageUrl(imageUrl) {
  if (!imageUrl) return imageUrl;
  let key = imageUrl;

  // Strip server proxy URL prefix: {SERVER_BASE_URL}/api/invoices/image/{key}
  const serverBase = (process.env.SERVER_BASE_URL || '').replace(/\/$/, '');
  const proxyPrefix = `${serverBase}/api/invoices/image/`;
  if (serverBase && key.startsWith(proxyPrefix)) {
    key = key.slice(proxyPrefix.length);
    key = key.split('?')[0];
    return key;
  }

  // Strip R2_PUBLIC_BASE_URL prefix if present
  const baseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (baseUrl && key.startsWith(`${baseUrl}/`)) {
    key = key.slice(baseUrl.length + 1);
  } else if (/^https?:\/\//.test(key)) {
    // Generic fallback for any full URL: strip origin then strip known proxy path prefix
    try {
      const parsed = new URL(key);
      let pathname = parsed.pathname.replace(/^\//, '');
      // Remove proxy image path prefix if present (handles unknown server origins)
      const proxyPathPrefix = 'api/invoices/image/';
      if (pathname.startsWith(proxyPathPrefix)) {
        pathname = pathname.slice(proxyPathPrefix.length);
      }
      key = pathname;
    } catch {
      // not a valid URL, treat as key
    }
  }

  // Strip query string
  key = key.split('?')[0];

  // Strip proxy path prefix that may have been incorrectly stored as the key
  const bareProxyPrefix = 'api/invoices/image/';
  if (key.startsWith(bareProxyPrefix)) {
    key = key.slice(bareProxyPrefix.length);
  }

  return key;
}

/**
 * Build an absolute image URL for API responses.
 * - Server proxy mode: returns {SERVER_BASE_URL}/api/invoices/image/{key}
 * - Default: returns {R2_PUBLIC_BASE_URL}/{key}
 */
function resolveImageUrl(key) {
  if (!key) return key;
  // Normalise: if someone stored a full URL, extract the key first
  const normalised = extractKeyFromImageUrl(key);

  if (process.env.R2_USE_SERVER_PROXY === 'true' && process.env.SERVER_BASE_URL) {
    const serverBase = process.env.SERVER_BASE_URL.replace(/\/$/, '');
    return `${serverBase}/api/invoices/image/${normalised}`;
  }
  return buildPublicUrl(normalised);
}

async function uploadInvoiceImage({ buffer, contentType, originalName }) {
  const client = getR2Client();
  const key = buildInvoiceImageKey(originalName, contentType);

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000'
  });

  await client.send(command);

  return {
    key,
    imageUrl: buildPublicUrl(key)
  };
}

async function createInvoiceUploadSignedUrl({ filename, contentType }) {
  console.log('createInvoiceUploadSignedUrl service called with', { filename, contentType });
  const key = buildInvoiceImageKey(filename, contentType);
  console.log('Generated invoice image key:', key);

  // --- Path 1: Server proxy mode (client uploads through our Express server) ---
  const useServerProxy = process.env.R2_USE_SERVER_PROXY === 'true';
  if (useServerProxy) {
    console.log('Using server proxy for upload');
    const workerSecret = process.env.R2_WORKER_SECRET || process.env.JWT_SECRET;
    const payload = {
      key,
      contentType,
      expiresAt: Date.now() + (5 * 60 * 1000),
    };
    // Reuse the same HMAC-signing logic as WorkerProxyService
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', workerSecret)
      .update(data)
      .digest('base64');
    const dataB64 = Buffer.from(data).toString('base64');
    const uploadToken = `${dataB64}.${signature}`;

    return {
      key,
      signedUrl: '/api/invoices/upload',
      uploadToken,
      imageUrl: key,
      useServerProxy: true,
    };
  }

  // --- Path 2: Worker proxy mode (client uploads to Cloudflare Worker) ---
  const useWorkerProxy = process.env.R2_USE_WORKER_PROXY === 'true';
  const workerUrl = process.env.R2_WORKER_URL;
  const workerSecret = process.env.R2_WORKER_SECRET;
  const downloadDomain = process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '');

  if (useWorkerProxy && workerUrl && workerSecret && downloadDomain) {
    console.log('Using worker proxy for signed URL creation');
    const workerProxy = new WorkerProxyService({
      workerUrl,
      uploadSecret: workerSecret,
      downloadDomain
    });

    const { uploadUrl, uploadToken, downloadUrl, multipart } = workerProxy.generateUploadUrl(
      key,
      contentType,
      60 * 5
    );

    console.log('Worker proxy signed url generated');
    return {
      key,
      signedUrl: uploadUrl,
      uploadToken,
      imageUrl: downloadUrl,
      useWorkerProxy: true,
      multipart
    };
  }

  // --- Path 3: Direct S3 presigned URL ---
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000'
  });

  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: 60 * 5
  });

  console.log('Signed URL created without worker proxy');
  return {
    key,
    signedUrl,
    imageUrl: buildPublicUrl(key)
  };
}

async function deleteInvoiceImageByUrl(imageUrl) {
  ensureR2Config();
  const client = getR2Client();
  const key = extractKeyFromImageUrl(imageUrl);
  try {
    await client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key
    }));
    return true;
  } catch (err) {
    console.error('Failed to delete invoice image from bucket', err);
    return false;
  }
}

/**
 * Stream an invoice image from R2 by key.
 * Returns { body, contentType, contentLength } or null if not found.
 */
async function getInvoiceImageStream(key) {
  ensureR2Config();
  const client = getR2Client();
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key
    }));
    return {
      body: response.Body,
      contentType: response.ContentType || 'application/octet-stream',
      contentLength: response.ContentLength,
    };
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Upload a buffer to R2 using a pre-determined key.
 * Used by the server proxy upload endpoint.
 */
async function uploadInvoiceImageByKey(key, buffer, contentType) {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000'
  });
  await client.send(command);
  return { key };
}

/**
 * Verify an HMAC-signed upload token (same format as WorkerProxyService).
 * Returns the decoded payload { key, contentType, expiresAt } or null.
 */
function verifyUploadToken(token) {
  try {
    const [dataB64, signatureB64] = token.split('.');
    if (!dataB64 || !signatureB64) return null;

    const secret = process.env.R2_WORKER_SECRET || process.env.JWT_SECRET;
    const data = Buffer.from(dataB64, 'base64').toString('utf-8');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64');

    if (expected !== signatureB64) return null;

    const payload = JSON.parse(data);
    if (Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  uploadInvoiceImage,
  createInvoiceUploadSignedUrl,
  deleteInvoiceImageByUrl,
  extractKeyFromImageUrl,
  resolveImageUrl,
  getInvoiceImageStream,
  uploadInvoiceImageByKey,
  verifyUploadToken
};
