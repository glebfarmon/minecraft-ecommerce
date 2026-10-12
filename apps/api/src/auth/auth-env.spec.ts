import {authEnv} from './auth-env'

const SECRET = 'x'.repeat(32)
const URL = 'https://admin.example.com'

describe('authEnv', () => {
  it('refuses production without BETTER_AUTH_SECRET', () => {
    expect(() => authEnv({NODE_ENV: 'production', BETTER_AUTH_URL: URL})).toThrow(
      /BETTER_AUTH_SECRET/
    )
  })

  it('refuses production with a secret shorter than 32 characters', () => {
    expect(() =>
      authEnv({NODE_ENV: 'production', BETTER_AUTH_URL: URL, BETTER_AUTH_SECRET: 'short'})
    ).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('refuses production without BETTER_AUTH_URL', () => {
    expect(() => authEnv({NODE_ENV: 'production', BETTER_AUTH_SECRET: SECRET})).toThrow(
      /BETTER_AUTH_URL/
    )
  })

  it('uses the production values when both are set', () => {
    expect(
      authEnv({NODE_ENV: 'production', BETTER_AUTH_URL: URL, BETTER_AUTH_SECRET: SECRET})
    ).toEqual({baseURL: URL, secret: SECRET})
  })

  it('falls back to dev values outside production', () => {
    const env = authEnv({NODE_ENV: 'development'})
    expect(env.baseURL).toBe('http://admin.shop.localhost')
    expect(env.secret.length).toBeGreaterThanOrEqual(32)
    expect(() => authEnv({})).not.toThrow()
  })
})
