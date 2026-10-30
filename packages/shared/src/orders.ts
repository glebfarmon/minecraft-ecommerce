import * as v from 'valibot'

import {CurrencySchema, LocaleSchema} from './catalog'
import {AdminDeliverySchema, PUBLIC_DELIVERY_STATES} from './delivery'
import {OrderLinesSchema} from './order-lines'
import {LoosePromoCodeSchema} from './promo'

export {OrderLinesSchema}

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

export {ORDER_MAX_LINES, ORDER_MAX_QTY} from './order-lines'
/** The game server's nickname rule; RCON commands are rendered only from nicks that pass it. */
export const NICK_PATTERN = /^[A-Za-z0-9_]{3,16}$/
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/

const Minor = v.pipe(v.number(), v.integer(), v.minValue(0))
const Iso = v.pipe(v.string(), v.isoTimestamp())

export const CreateOrderRequestSchema = v.strictObject({
  lines: OrderLinesSchema,
  currency: CurrencySchema,
  locale: LocaleSchema,
  nick: v.pipe(v.string(), v.trim(), v.regex(NICK_PATTERN)),
  email: v.pipe(v.string(), v.trim(), v.maxLength(254), v.email()),
  deliveryConsent: v.literal(true),
  termsAccepted: v.literal(true),
  turnstileToken: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  promoCode: v.optional(LoosePromoCodeSchema)
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
  subtotalMinor: Minor,
  discountMinor: Minor,
  promoCode: v.nullable(v.string()),
  totalMinor: Minor,
  servers: v.array(OrderServerGroupSchema),
  createdAt: Iso,
  paidAt: v.nullable(Iso),
  delivery: v.picklist(PUBLIC_DELIVERY_STATES)
})
export type PublicOrder = v.InferOutput<typeof PublicOrderSchema>

/** One bought line on the storefront's purchase feed. The buyer's email and the order id never leave the API. */
export const RecentPurchaseSchema = v.object({
  id: v.string(),
  nick: v.string(),
  server: v.string(),
  product: v.string(),
  currency: CurrencySchema,
  amountMinor: Minor,
  paidAt: Iso
})
export type RecentPurchase = v.InferOutput<typeof RecentPurchaseSchema>
export const RecentPurchasesSchema = v.object({purchases: v.array(RecentPurchaseSchema)})
export type RecentPurchases = v.InferOutput<typeof RecentPurchasesSchema>

export const AdminOrderListItemSchema = v.object({
  id: v.string(),
  publicId: v.string(),
  createdAt: Iso,
  nick: v.string(),
  email: v.string(),
  currency: CurrencySchema,
  totalMinor: Minor,
  status: OrderStatusSchema,
  needsAttention: v.boolean()
})
export type AdminOrderListItem = v.InferOutput<typeof AdminOrderListItemSchema>
export const AdminOrderPageSchema = v.object({
  orders: v.array(AdminOrderListItemSchema),
  nextCursor: v.nullable(v.string()),
  attentionCount: Minor
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
  stripePaymentIntentId: v.nullable(v.string()),
  deliveryConsentAt: Iso,
  deliveries: v.array(AdminDeliverySchema)
})
export type AdminOrder = v.InferOutput<typeof AdminOrderSchema>

export const STATS_RANGES = ['7d', '30d'] as const
export const OrderStatsQuerySchema = v.object({
  range: v.optional(v.picklist(STATS_RANGES), '7d'),
  currency: v.optional(CurrencySchema, 'EUR')
})
export type OrderStatsQuery = v.InferOutput<typeof OrderStatsQuerySchema>

const Count = v.pipe(v.number(), v.integer(), v.minValue(0))
export const OrderStatsSchema = v.object({
  range: v.picklist(STATS_RANGES),
  /** The reporting currency of every `*Minor` figure except `byCurrency`. */
  currency: CurrencySchema,
  from: Iso,
  to: Iso,
  revenueMinor: Minor,
  previousRevenueMinor: Minor,
  paidCount: Count,
  previousPaidCount: Count,
  averageMinor: v.nullable(Minor),
  ltvMinor: v.nullable(Minor),
  buyers: Count,
  /** Paid orders in the range still without an exchange rate (not in the converted figures). */
  awaitingRate: Count,
  /** The same for the previous period, so its comparison can be flagged as partial. */
  previousAwaitingRate: Count,
  expiredCount: Count,
  conversion: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  byStatus: v.array(v.object({status: OrderStatusSchema, count: Count})),
  /** Paid orders by the currency they were paid in; sums are in that original currency. */
  byCurrency: v.array(v.object({currency: CurrencySchema, count: Count, totalMinor: Minor})),
  daily: v.array(
    v.object({day: v.pipe(v.string(), v.isoDate()), totalMinor: Minor, paidCount: Count})
  ),
  topProducts: v.array(
    v.object({productId: v.string(), name: v.string(), serverName: v.string(), quantity: Count})
  )
})
export type OrderStats = v.InferOutput<typeof OrderStatsSchema>
