const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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
  const baseUrl = process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
  let key = imageUrl.replace(baseUrl + '/', '');
  // Remove query string if present
  key = key.split('?')[0];
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

module.exports = {
  uploadInvoiceImage,
  createInvoiceUploadSignedUrl,
  deleteInvoiceImageByUrl
};
