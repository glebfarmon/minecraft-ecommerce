import * as v from 'valibot'

import {CurrencySchema, LocaleSchema} from './catalog'

export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'DELIVERED',
  'EXPIRED',
  'REFUNDED',
  'DISPUTED'
] as const
export const OrderStatusSchema = v.picklist(ORDER_STATUSES)
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Same caps as the storefront cart (`apps/web/src/config/cart.ts`). */
export const ORDER_MAX_LINES = 30
export const ORDER_MAX_QTY = 99
/** The game server's nickname rule; RCON commands are rendered only from nicks that pass it. */
export const NICK_PATTERN = /^[A-Za-z0-9_]{3,16}$/
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/

const SLUG = /^[a-z0-9-]{1,40}$/
const Minor = v.pipe(v.number(), v.integer(), v.minValue(0))
const Iso = v.pipe(v.string(), v.isoTimestamp())

const OrderLineSchema = v.strictObject({
  server: v.pipe(v.string(), v.regex(SLUG)),
  slug: v.pipe(v.string(), v.regex(SLUG)),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(ORDER_MAX_QTY))
})

export const CreateOrderRequestSchema = v.strictObject({
  lines: v.pipe(
    v.array(OrderLineSchema),
    v.minLength(1),
    v.maxLength(ORDER_MAX_LINES),
    v.check(
      lines => new Set(lines.map(l => `${l.server}/${l.slug}`)).size === lines.length,
      'duplicate line'
    )
  ),
  currency: CurrencySchema,
  locale: LocaleSchema,
  nick: v.pipe(v.string(), v.trim(), v.regex(NICK_PATTERN)),
  email: v.pipe(v.string(), v.trim(), v.maxLength(254), v.email()),
  deliveryConsent: v.literal(true),
  termsAccepted: v.literal(true),
  turnstileToken: v.pipe(v.string(), v.minLength(1), v.maxLength(2048))
})
export type CreateOrderRequest = v.InferOutput<typeof CreateOrderRequestSchema>

export const CreateOrderResponseSchema = v.object({publicId: v.string(), redirectUrl: v.string()})
export type CreateOrderResponse = v.InferOutput<typeof CreateOrderResponseSchema>

export const OrderItemViewSchema = v.object({
  productName: v.string(),
  quantity: v.number(),
  unitAmountMinor: Minor
})
export type OrderItemView = v.InferOutput<typeof OrderItemViewSchema>
export const OrderServerGroupSchema = v.object({
  serverName: v.string(),
  items: v.array(OrderItemViewSchema)
})
export type OrderServerGroup = v.InferOutput<typeof OrderServerGroupSchema>

export const PublicOrderSchema = v.object({
  publicId: v.string(),
  status: OrderStatusSchema,
  nick: v.string(),
  email: v.string(),
  currency: CurrencySchema,
  totalMinor: Minor,
  servers: v.array(OrderServerGroupSchema),
  createdAt: Iso,
  paidAt: v.nullable(Iso)
})
export type PublicOrder = v.InferOutput<typeof PublicOrderSchema>

export const AdminOrderListItemSchema = v.object({
  id: v.string(),
  publicId: v.string(),
  createdAt: Iso,
  nick: v.string(),
  email: v.string(),
  currency: CurrencySchema,
  totalMinor: Minor,
  status: OrderStatusSchema
})
export type AdminOrderListItem = v.InferOutput<typeof AdminOrderListItemSchema>
export const AdminOrderPageSchema = v.object({
  orders: v.array(AdminOrderListItemSchema),
  nextCursor: v.nullable(v.string())
})
export type AdminOrderPage = v.InferOutput<typeof AdminOrderPageSchema>

export const AdminOrderQuerySchema = v.object({
  q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(100))),
  status: v.optional(OrderStatusSchema),
  cursor: v.optional(v.pipe(v.string(), v.maxLength(64)))
})
export type AdminOrderQuery = v.InferOutput<typeof AdminOrderQuerySchema>

export const AdminOrderSchema = v.object({
  ...PublicOrderSchema.entries,
  id: v.string(),
  locale: LocaleSchema,
  stripeSessionId: v.nullable(v.string()),
  deliveryConsentAt: Iso,
  subtotalMinor: Minor,
  discountMinor: Minor
})
export type AdminOrder = v.InferOutput<typeof AdminOrderSchema>
