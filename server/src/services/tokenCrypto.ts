import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';

function encryptionKey(): Buffer | null {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(token: string): string {
  const key = encryptionKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY is required in production');
    }
    return token;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const key = encryptionKey();
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY is required to decrypt the GitHub token');
  const [ivText, tagText, encryptedText] = value.slice(PREFIX.length).split('.');
  if (!ivText || !tagText || !encryptedText) throw new Error('Stored GitHub token is malformed');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
