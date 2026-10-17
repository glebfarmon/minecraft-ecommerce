const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
/** Cloudflare's documented always-pass secret; the matching site key is 1x00000000000000000000AA. */
const TEST_SECRET = '1x0000000000000000000000000000000AA'
const TIMEOUT_MS = 5000

export const TURNSTILE = Symbol('TURNSTILE')

export class TurnstileVerifier {
  constructor(
    private readonly secret: string,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  /** Fails closed: an unreachable Cloudflare blocks orders rather than letting bots through. */
  async verify(token: string, ip: string): Promise<boolean> {
    try {
      const res = await this.fetchFn(SITEVERIFY, {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({secret: this.secret, response: token, remoteip: ip}).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      if (!res.ok) return false
      return ((await res.json()) as {success?: unknown}).success === true
    } catch {
      return false
    }
  }
}

export function createTurnstile(env: Partial<Record<string, string>>): TurnstileVerifier {
  if (env.TURNSTILE_SECRET_KEY) return new TurnstileVerifier(env.TURNSTILE_SECRET_KEY)
  if (env.NODE_ENV === 'production')
    throw new Error('TURNSTILE_SECRET_KEY must be set in production')
  return new TurnstileVerifier(TEST_SECRET)
}
