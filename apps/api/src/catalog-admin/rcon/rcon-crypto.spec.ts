import {randomBytes} from 'node:crypto'

import {RconKeyMissingError, decryptRconPassword, encryptRconPassword, rconKey} from './rcon-crypto'

const key = randomBytes(32)

describe('RCON password encryption', () => {
  it('round-trips and never stores the plain text', () => {
    const stored = encryptRconPassword('hunter2', key)
    expect(stored).not.toContain('hunter2')
    expect(stored.startsWith('v1:')).toBe(true)
    expect(decryptRconPassword(stored, key)).toBe('hunter2')
  })

  it('uses a fresh IV each time', () => {
    expect(encryptRconPassword('same', key)).not.toBe(encryptRconPassword('same', key))
  })

  it('refuses a tampered value or another key', () => {
    const stored = encryptRconPassword('hunter2', key)
    const parts = stored.split(':')
    parts[3] = Buffer.from('xxxxxxx').toString('base64')
    expect(() => decryptRconPassword(parts.join(':'), key)).toThrow()
    expect(() => decryptRconPassword(stored, randomBytes(32))).toThrow()
  })

  it('refuses a truncated authentication tag', () => {
    const parts = encryptRconPassword('hunter2', key).split(':')
    parts[2] = Buffer.from(parts[2] ?? '', 'base64')
      .subarray(0, 4)
      .toString('base64')
    expect(() => decryptRconPassword(parts.join(':'), key)).toThrow()
  })

  it('reads a 32-byte base64 key and refuses a missing or short one', () => {
    expect(rconKey({RCON_ENCRYPTION_KEY: key.toString('base64')})).toEqual(key)
    expect(() => rconKey({})).toThrow(RconKeyMissingError)
    expect(() => rconKey({RCON_ENCRYPTION_KEY: randomBytes(16).toString('base64')})).toThrow(
      RconKeyMissingError
    )
  })
})
