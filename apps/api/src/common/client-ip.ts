type HeaderBag = Headers | Record<string, string | string[] | undefined>

/**
 * Set by the HTTP layer on every Better Auth request (overwriting anything the client sent), so
 * Better Auth's own limiter and our hooks see the same address as the Nest throttler.
 */
export const CLIENT_IP_HEADER = 'x-shop-client-ip'

function header(headers: HeaderBag, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const value = headers[name]
  return Array.isArray(value) ? value.join(',') : value
}

/**
 * The client address every limiter and audit row uses (one rule for the whole API):
 * 1. `CF-Connecting-IP`, only when `TRUST_CF_CONNECTING_IP=true` (production sits behind Cloudflare
 *    and the origin must be reachable only through it, otherwise anyone can set this header);
 * 2. else the LAST `X-Forwarded-For` hop: Traefik appends the peer it saw, so every earlier hop is
 *    client-controlled and a rotated first hop must never buy a fresh budget;
 * 3. else the socket peer; else one shared `unknown` bucket (stricter, not looser).
 * Without a proxy in front (local dev on :4000) X-Forwarded-For is client-set: limits are advisory there.
 */
export function clientIp(
  headers: HeaderBag | undefined,
  socketPeer?: string,
  env: Partial<Record<string, string>> = process.env
): string {
  if (headers) {
    if (env.TRUST_CF_CONNECTING_IP === 'true') {
      const cf = header(headers, 'cf-connecting-ip')?.trim()
      if (cf) return cf
    }
    const last = header(headers, 'x-forwarded-for')
      ?.split(',')
      .map(hop => hop.trim())
      .filter(Boolean)
      .at(-1)
    if (last) return last
  }
  return socketPeer || 'unknown'
}

/** For code that only sees a web `Request` (Better Auth hooks): the stamped address, else resolve. */
export function requestIp(headers: Headers | undefined): string {
  return headers?.get(CLIENT_IP_HEADER)?.trim() || clientIp(headers)
}
