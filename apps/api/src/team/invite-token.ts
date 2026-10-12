import {createHash, randomBytes} from 'node:crypto'

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const hashInviteToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

export function newInviteToken(): {token: string; tokenHash: string} {
  const token = randomBytes(32).toString('base64url')
  return {token, tokenHash: hashInviteToken(token)}
}
