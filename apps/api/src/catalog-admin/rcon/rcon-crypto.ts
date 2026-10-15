import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto'

/** `RCON_ENCRYPTION_KEY` is absent or not 32 bytes: RCON writes and tests answer 503. */
export class RconKeyMissingError extends Error {}

export function rconKey(env: Partial<Record<string, string>> = process.env): Buffer {
  const raw = env.RCON_ENCRYPTION_KEY
  if (!raw) throw new RconKeyMissingError('RCON_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32)
    throw new RconKeyMissingError('RCON_ENCRYPTION_KEY must be 32 bytes, base64-encoded')
  return key
}

/** AES-256-GCM with a fresh 12-byte IV: `v1:<iv>:<tag>:<ciphertext>`, each part base64. */
export function encryptRconPassword(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv, cipher.getAuthTag(), data]
    .map(p => (typeof p === 'string' ? p : p.toString('base64')))
    .join(':')
}

/** Throws on a wrong key or a modified value (GCM authentication). */
export function decryptRconPassword(stored: string, key: Buffer): string {
  const [version, iv, tag, data] = stored.split(':')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('unknown RCON password format')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
    'utf8'
  )
}
