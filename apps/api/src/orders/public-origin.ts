/** The storefront origin for links sent to buyers (Stripe return URLs, receipts); empty env counts as unset. */
export function publicWebOrigin(env: Partial<Record<string, string>> = process.env): string {
  const configured = env.PUBLIC_WEB_ORIGIN || undefined
  if (!configured && env.NODE_ENV === 'production')
    throw new Error('PUBLIC_WEB_ORIGIN must be set in production')
  return configured ?? 'http://shop.localhost'
}
