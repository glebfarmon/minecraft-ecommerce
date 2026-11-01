import * as v from 'valibot'

/** Its own module so `delivery.ts` can use it without an import cycle through `orders.ts`. */
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
