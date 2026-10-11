import {CART_COOKIE, CART_COOKIE_MAX_AGE, MAX_LINES, MAX_QTY} from '@/config/cart'
import type {CartLine} from '@/features/cart/types'

const SLUG = /^[a-z0-9-]+$/
const QTY = /^\d+$/

/**
 * `cart` cookie value → lines. The cookie is user-editable: keep well-formed lines only,
 * merge duplicates, clamp quantities to 1..MAX_QTY and keep the first MAX_LINES lines.
 */
export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return []
  const lines: CartLine[] = []
  for (const part of raw.split('|')) {
    const [server, slug, qtyText, ...rest] = part.split(':')
    if (rest.length > 0 || !server || !slug || !qtyText) continue
    if (!SLUG.test(server) || !SLUG.test(slug) || !QTY.test(qtyText)) continue
    const qty = Number(qtyText)
    if (qty < 1) continue
    const hit = lines.find(l => l.server === server && l.slug === slug)
    if (hit) hit.qty = Math.min(hit.qty + qty, MAX_QTY)
    else if (lines.length < MAX_LINES) lines.push({server, slug, qty: Math.min(qty, MAX_QTY)})
  }
  return lines
}

/** Lines → cookie value: `server:slug:qty` joined by `|` (RFC 6265 forbids `,` in a cookie value). */
export function serializeCart(lines: readonly CartLine[]): string {
  return lines.map(l => `${l.server}:${l.slug}:${String(l.qty)}`).join('|')
}

export function writeCartCookie(lines: readonly CartLine[]): void {
  document.cookie = `${CART_COOKIE}=${serializeCart(lines)}; path=/; max-age=${String(CART_COOKIE_MAX_AGE)}; SameSite=Lax`
}
