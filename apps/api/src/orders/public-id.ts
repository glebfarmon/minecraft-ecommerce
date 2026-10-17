import {randomBytes} from 'node:crypto'

/** The unguessable id in order URLs: 128 random bits, 22 URL-safe characters. */
export const newPublicId = (): string => randomBytes(16).toString('base64url')
