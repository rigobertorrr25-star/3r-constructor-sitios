import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Cifra los tokens de Meta con AES-256-GCM. La llave sale de `DATA_ENCRYPTION_KEY` (o, si no hay, de JWT_ACCESS_SECRET). */
const key = () =>
  createHash('sha256')
    .update(`3r-whatsapp:${process.env.DATA_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || 'dev-secret'}`)
    .digest();

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(sealed: string) {
  const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
