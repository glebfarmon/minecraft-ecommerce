/** The storefront origin for links sent to buyers (Stripe return URLs, receipts); empty env counts as unset. */
export function publicWebOrigin(env: Partial<Record<string, string>> = process.env): string {
  const configured = env.PUBLIC_WEB_ORIGIN?.replace(/\/+$/, '') || undefined
  if (!configured) {
    if (env.NODE_ENV === 'production')
      throw new Error('PUBLIC_WEB_ORIGIN must be set in production')
    return 'http://shop.localhost'
  }
  if (env.NODE_ENV === 'production' && !isHttpUrl(configured))
    throw new Error(`PUBLIC_WEB_ORIGIN must be an http(s) URL, got "${configured}"`)
  return configured
}

function isHttpUrl(value: string): boolean {
  try {
    const {protocol} = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
