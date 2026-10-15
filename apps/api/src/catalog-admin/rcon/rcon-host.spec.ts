import {RconHostPrivateError, isPrivateAddress, resolveRconHost} from './rcon-host'

describe('RCON host guard', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.20.1.1',
    '192.168.1.10',
    '100.64.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.5',
    '::ffff:127.0.0.1'
  ])('treats %s as internal', ip => {
    expect(isPrivateAddress(ip)).toBe(true)
  })

  it.each(['1.1.1.1', '95.217.1.1', '2a01:4f8::1'])('treats %s as public', ip => {
    expect(isPrivateAddress(ip)).toBe(false)
  })

  it('refuses a name that resolves to loopback unless private hosts are allowed', async () => {
    await expect(resolveRconHost('localhost', false)).rejects.toBeInstanceOf(RconHostPrivateError)
    await expect(resolveRconHost('localhost', true)).resolves.toMatch(/^(127\.0\.0\.1|::1)$/)
  })

  it('returns a literal public IP as is', async () => {
    await expect(resolveRconHost('1.1.1.1', false)).resolves.toBe('1.1.1.1')
  })
})
