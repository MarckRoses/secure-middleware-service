const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

// Ensure the key is 32 bytes (64 hex characters if provided as hex, or just a 32-byte buffer)
// The requirements say: "The encryption key must come from environment variable AUDIT_ENCRYPTION_KEY"
function getEncryptionKey() {
  const keyHex = process.env.AUDIT_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('AUDIT_ENCRYPTION_KEY is not defined');
  }
  // Assume input is a 64-char hex string (32 bytes) or fallback to treating it as raw string if length matches? 
  // Requirement says "server should refuse to start with a clear error" if key is missing.
  // We'll enforce 64 hex chars for robustness as it's a common practice for 256-bit keys.
  if (keyHex.length !== 64) {
    throw new Error('AUDIT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a message using AES-256-GCM.
 * @param {string} text - The text to encrypt.
 * @returns {string} - Base64 encoded JSON string containing { iv, ciphertext, authTag }.
 */
function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM recommended IV size is 12 bytes
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Combine into a single structure
  const blob = {
    iv: iv.toString('hex'),
    ciphertext: encrypted,
    authTag: authTag
  };

  // Return as base64 string
  return Buffer.from(JSON.stringify(blob)).toString('base64');
}

/**
 * Decrypts a message (helper for verification, not strictly required by API logic but good for testing).
 * @param {string} encryptedBase64 
 * @returns {string}
 */
function decrypt(encryptedBase64) {
  const key = getEncryptionKey();
  const blobStr = Buffer.from(encryptedBase64, 'base64').toString('utf8');
  const blob = JSON.parse(blobStr);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(blob.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'hex'));

  let decrypted = decipher.update(blob.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Validate key presence on module load (or we could do it in server startup)
// We'll trust the server to check this on startup to fail fast as requested.

module.exports = {
  encrypt,
  decrypt,
  getEncryptionKey // Exposed for startup check
};
