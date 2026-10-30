import * as v from 'valibot'

/** Same caps as the storefront cart (`apps/web/src/config/cart.ts`). */
export const ORDER_MAX_LINES = 30
export const ORDER_MAX_QTY = 99

const SLUG = /^[a-z0-9-]{1,40}$/

const OrderLineSchema = v.strictObject({
  server: v.pipe(v.string(), v.regex(SLUG)),
  slug: v.pipe(v.string(), v.regex(SLUG)),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(ORDER_MAX_QTY))
})

/** Split from `orders.ts` so `promo.ts` and `orders.ts` do not import each other. */
export const OrderLinesSchema = v.pipe(
  v.array(OrderLineSchema),
  v.minLength(1),
  v.maxLength(ORDER_MAX_LINES),
  v.check(
    lines => new Set(lines.map(l => `${l.server}/${l.slug}`)).size === lines.length,
    'duplicate line'
  )
)
