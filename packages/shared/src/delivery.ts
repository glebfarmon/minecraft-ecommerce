import * as v from 'valibot'

export const DELIVERY_STATUSES = [
  'PENDING',
  'RUNNING',
  'DONE',
  'FAILED',
  'NEEDS_REVIEW',
  'CANCELLED'
] as const
export const DeliveryStatusSchema = v.picklist(DELIVERY_STATUSES)
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

/** What the buyer sees of an order's delivery. */
export const PUBLIC_DELIVERY_STATES = ['none', 'delivering', 'delayed', 'delivered'] as const
export type PublicDeliveryState = (typeof PUBLIC_DELIVERY_STATES)[number]

const Iso = v.pipe(v.string(), v.isoTimestamp())

export const AdminDeliverySchema = v.object({
  id: v.string(),
  kind: v.picklist(['GRANT', 'REVOKE', 'RESTORE']),
  status: DeliveryStatusSchema,
  serverName: v.string(),
  productName: v.nullable(v.string()),
  commands: v.array(v.string()),
  commandsDone: v.pipe(v.number(), v.integer(), v.minValue(0)),
  attempts: v.pipe(v.number(), v.integer(), v.minValue(0)),
  nextAttemptAt: Iso,
  lastError: v.nullable(v.string()),
  replies: v.array(v.string()),
  createdAt: Iso
})
export type AdminDelivery = v.InferOutput<typeof AdminDeliverySchema>

/** A stuck delivery in the admin's deliveries list, with what it belongs to. */
export const AdminDeliveryListItemSchema = v.object({
  ...AdminDeliverySchema.entries,
  nick: v.string(),
  orderId: v.nullable(v.string()),
  orderPublicId: v.nullable(v.string()),
  productName: v.nullable(v.string())
})
export type AdminDeliveryListItem = v.InferOutput<typeof AdminDeliveryListItemSchema>

export const AdminDeliveryPageSchema = v.object({
  deliveries: v.array(AdminDeliveryListItemSchema),
  nextCursor: v.nullable(v.string()),
  /** Every `FAILED` or `NEEDS_REVIEW` delivery, whatever page this is. */
  attentionCount: v.pipe(v.number(), v.integer(), v.minValue(0))
})
export type AdminDeliveryPage = v.InferOutput<typeof AdminDeliveryPageSchema>

export const AdminDeliveryQuerySchema = v.object({
  cursor: v.optional(v.pipe(v.string(), v.maxLength(64)))
})
export type AdminDeliveryQuery = v.InferOutput<typeof AdminDeliveryQuerySchema>
