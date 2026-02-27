const crypto = require('crypto');
const { promisify } = require('util');

const randBytes = promisify(crypto.randomBytes);

/**
 * Service to generate upload tokens for the Cloudflare Worker proxy
 * This allows uploads to R2 through a custom domain, bypassing ISP blocks on r2.cloudflarestorage.com
 */
class WorkerProxyService {
  /**
   * @param {Object} options
   * @param {string} options.workerUrl - The worker URL (your custom domain, e.g., https://upload.yourdomain.com)
   * @param {string} options.uploadSecret - Shared secret for signing upload tokens
   * @param {string} options.downloadDomain - Download domain for generating download URLs
   */
  constructor({ workerUrl, uploadSecret, downloadDomain }) {
    this.workerUrl = workerUrl;
    this.uploadSecret = uploadSecret;
    this.downloadDomain = downloadDomain;
  }

  /**
   * Generate a unique ID for filename
   * @returns {Promise<string>}
   */
  async generateUniqueId() {
    const bytes = await randBytes(16);
    return bytes.toString('hex');
  }

  /**
   * Sign a token payload using HMAC-SHA256
   * @param {Object} payload 
   * @returns {string}
   */
  signToken(payload) {
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.uploadSecret)
      .update(data)
      .digest('base64');
    const dataB64 = Buffer.from(data).toString('base64');
    return `${dataB64}.${signature}`;
  }

  /**
   * Generate upload URL and token for the worker proxy
   * @param {string} key - Full object key in the bucket
   * @param {string} contentType - MIME type of file
   * @param {number} expiresIn - Expiry in seconds (default 10 min)
   * @returns {{ uploadUrl: string, uploadToken: string, downloadUrl: string, multipart: object }}
   */
  generateUploadUrl(key, contentType, expiresIn = 600) {
    const payload = {
      key,
      contentType,
      expiresAt: Date.now() + (expiresIn * 1000),
    };

    const uploadToken = this.signToken(payload);
    const downloadUrl = `${this.downloadDomain}/${key}`;
    const uploadUrl = `${this.workerUrl}/api/upload`;

    return { 
      uploadUrl, 
      uploadToken, 
      downloadUrl,
      multipart: {
        initUrl: `${this.workerUrl}/api/upload/multipart/init`,
        chunkUrl: `${this.workerUrl}/api/upload/multipart/chunk`,
        completeUrl: `${this.workerUrl}/api/upload/multipart/complete`,
        abortUrl: `${this.workerUrl}/api/upload/multipart/abort`,
      }
    };
  }
}

module.exports = WorkerProxyService;
