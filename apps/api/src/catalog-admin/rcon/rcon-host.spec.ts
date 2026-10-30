import {RconHostPrivateError, isPrivateAddress, resolveRconHost} from './rcon-host'

async function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const saved = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]))
  const apply = (v: Record<string, string | undefined>) => {
    for (const [k, val] of Object.entries(v)) {
      if (val === undefined) Reflect.deleteProperty(process.env, k)
      else process.env[k] = val
    }
  }
  apply(vars)
  try {
    await run()
  } finally {
    apply(saved)
  }
}

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
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '64:ff9b::a00:5',
    '2002:a00:5::1',
    '::127.0.0.1',
    '198.18.0.1',
    '192.0.0.8',
    'not-an-ip'
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

  it('ignores RCON_ALLOW_PRIVATE_HOSTS in production', async () => {
    const saved = {node: process.env.NODE_ENV, allow: process.env.RCON_ALLOW_PRIVATE_HOSTS}
    process.env.RCON_ALLOW_PRIVATE_HOSTS = 'true'
    try {
      process.env.NODE_ENV = 'production'
      await expect(resolveRconHost('127.0.0.1')).rejects.toBeInstanceOf(RconHostPrivateError)
      process.env.NODE_ENV = 'development'
      await expect(resolveRconHost('127.0.0.1')).resolves.toBe('127.0.0.1')
    } finally {
      process.env.NODE_ENV = saved.node
      if (saved.allow === undefined) delete process.env.RCON_ALLOW_PRIVATE_HOSTS
      else process.env.RCON_ALLOW_PRIVATE_HOSTS = saved.allow
    }
  })

  it('RCON_ALLOW_PRIVATE_HOSTS=true with RCON_ALLOW_PRIVATE_IN_PRODUCTION=true allows private addresses in production', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        RCON_ALLOW_PRIVATE_HOSTS: 'true',
        RCON_ALLOW_PRIVATE_IN_PRODUCTION: 'true'
      },
      async () => {
        await expect(resolveRconHost('127.0.0.1')).resolves.toBe('127.0.0.1')
      }
    )
  })

  it('RCON_ALLOW_PRIVATE_HOSTS=true alone is still refused in production', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        RCON_ALLOW_PRIVATE_HOSTS: 'true',
        RCON_ALLOW_PRIVATE_IN_PRODUCTION: undefined
      },
      async () => {
        await expect(resolveRconHost('127.0.0.1')).rejects.toBeInstanceOf(RconHostPrivateError)
      }
    )
  })

  it('returns a literal public IP as is', async () => {
    await expect(resolveRconHost('1.1.1.1', false)).resolves.toBe('1.1.1.1')
  })
})
