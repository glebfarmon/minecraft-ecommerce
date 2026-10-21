import {randomBytes} from 'node:crypto'

import {rconReady} from './rcon-ready'

const env = {RCON_ENCRYPTION_KEY: randomBytes(32).toString('base64')}
const server = {rconHost: 'mc.example.com', rconPort: 25575, rconPasswordEnc: 'v1:a:b:c'}

describe('rconReady', () => {
  it('is true when host, port, password and a valid key are present', () => {
    expect(rconReady(server, env)).toBe(true)
  })

  it.each(['rconHost', 'rconPort', 'rconPasswordEnc'] as const)('is false without %s', field => {
    expect(rconReady({...server, [field]: null}, env)).toBe(false)
  })

  it('is false when the encryption key is missing or not 32 bytes', () => {
    expect(rconReady(server, {})).toBe(false)
    expect(rconReady(server, {RCON_ENCRYPTION_KEY: randomBytes(31).toString('base64')})).toBe(false)
  })
})
