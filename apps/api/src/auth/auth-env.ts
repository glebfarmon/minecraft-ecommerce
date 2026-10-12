type Env = Partial<Record<'NODE_ENV' | 'BETTER_AUTH_URL' | 'BETTER_AUTH_SECRET', string>>

const DEV_URL = 'http://admin.shop.localhost'
// Public in the repo: usable only outside production.
const DEV_SECRET = 'dev-only-secret-change-me-at-least-32-chars'
const MIN_SECRET_LENGTH = 32

/** Better Auth's origin and signing secret; production refuses to start on missing or weak values. */
export function authEnv(env: Env): {baseURL: string; secret: string} {
  if (env.NODE_ENV !== 'production')
    return {baseURL: env.BETTER_AUTH_URL ?? DEV_URL, secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET}

  const secret = env.BETTER_AUTH_SECRET
  if (!secret || secret.length < MIN_SECRET_LENGTH)
    throw new Error(
      `BETTER_AUTH_SECRET must be set to at least ${String(MIN_SECRET_LENGTH)} characters in production`
    )
  const baseURL = env.BETTER_AUTH_URL
  if (!baseURL) throw new Error('BETTER_AUTH_URL must be set in production')
  return {baseURL, secret}
}
