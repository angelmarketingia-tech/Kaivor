import * as crypto from 'crypto';

// AES-256-GCM. Format: kv1:<ivB64>:<tagB64>:<ctB64>. Legacy base64 fallback.
const ALG = 'aes-256-gcm';
const VERSION = 'kv1';

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) {
    const seed = process.env.JWT_SECRET || 'admia-dev-fallback-key';
    return crypto.createHash('sha256').update(seed).digest();
  }
  if (/^[A-Za-z0-9+/=]+$/.test(k) && Buffer.from(k, 'base64').length === 32) {
    return Buffer.from(k, 'base64');
  }
  if (/^[a-f0-9]{64}$/i.test(k)) return Buffer.from(k, 'hex');
  return crypto.createHash('sha256').update(k).digest();
}

export function encrypt(plain: string): string {
  if (!plain) return '';
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decrypt(payload: string): string {
  if (!payload) return '';
  if (!payload.startsWith(VERSION + ':')) {
    try {
      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      if (/^[\x20-\x7E]+$/.test(decoded)) return decoded;
    } catch {}
    return payload;
  }
  const [, ivB64, tagB64, ctB64] = payload.split(':');
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
