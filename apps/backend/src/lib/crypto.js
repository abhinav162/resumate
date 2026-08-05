import crypto from 'crypto';

/**
 * Token encryption + OAuth state signing for the GitHub integration (M2.1).
 *
 * Tokens are encrypted at rest with AES-256-GCM using a 32-byte key from
 * GITHUB_TOKEN_ENCRYPTION_KEY (64 hex chars). The OAuth `state` parameter is
 * HMAC-signed so the callback (which arrives without auth headers) can safely
 * identify the connecting user.
 */

function getKey() {
  const hex = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'GITHUB_TOKEN_ENCRYPTION_KEY must be set to 64 hex chars (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

// HMAC key for state signing, derived from the encryption key so operators
// only manage one secret.
function getStateKey() {
  return crypto.createHash('sha256').update(getKey()).update(':oauth-state').digest();
}

/** Encrypts a token. Returns "iv:authTag:ciphertext" (base64 segments). */
export function encryptToken(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** Decrypts a payload produced by encryptToken. Throws on tampering. */
export function decryptToken(payload) {
  const key = getKey();
  const [iv, tag, ciphertext] = String(payload).split(':').map((s) => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Signs an OAuth state payload: base64url(json).hmac. `data` must be a small
 * JSON-serializable object (we store the user uuid + issue time).
 */
export function signState(data) {
  const body = Buffer.from(JSON.stringify({ ...data, t: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', getStateKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verifies a state token. Returns the decoded payload, or null when the
 * signature is invalid or the token is older than maxAgeMs (default 10 min).
 */
export function verifyState(token, maxAgeMs = 10 * 60 * 1000) {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', getStateKey()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof data.t !== 'number' || Date.now() - data.t > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}
