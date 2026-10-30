import type {Locale} from '@shop/shared/catalog'
import type {AdminOrder, OrderServerGroup, PublicOrder} from '@shop/shared/orders'

import {publicDeliveryState} from '../delivery/delivery-rules'
import type {DeliveryStatus, Order, OrderItem} from '../generated/prisma/client'
import {maskEmail} from './mask-email'

export type OrderWithItems = Order & {items: OrderItem[]}

/** Loaded with an order to derive its delivery state; REVOKE deliveries have no item and never count. */
export const ORDER_ITEMS_WITH_DELIVERY = {
  items: {orderBy: {id: 'asc'}, include: {deliveries: {select: {status: true}}}}
} as const
export type OrderWithDeliveries = Order & {
  items: (OrderItem & {deliveries: {status: DeliveryStatus}[]})[]
}
export const deliveryStatuses = (order: OrderWithDeliveries): {status: DeliveryStatus}[] =>
  order.items.flatMap(i => i.deliveries)

/** next-intl `localePrefix: 'as-needed'`: the default locale (en) has no prefix. */
export const localePrefix = (locale: Locale): string => (locale === 'en' ? '' : `/${locale}`)

function groupByServer(items: OrderItem[]): OrderServerGroup[] {
  const groups = new Map<string, OrderServerGroup>()
  for (const item of items) {
    let group = groups.get(item.serverName)
    if (!group) {
      group = {serverName: item.serverName, items: []}
      groups.set(item.serverName, group)
    }
    group.items.push({
      productName: item.productName,
      quantity: item.quantity,
      unitAmountMinor: item.unitAmountMinor
    })
  }
  return [...groups.values()]
}

export function toPublicOrder(
  order: OrderWithItems,
  deliveries: readonly {status: DeliveryStatus}[]
): PublicOrder {
  return {
    publicId: order.publicId,
    status: order.status,
    nick: order.nick,
    email: maskEmail(order.email),
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    promoCode: order.promoCode,
    totalMinor: order.totalMinor,
    servers: groupByServer(order.items),
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    delivery: publicDeliveryState(
      order.status,
      deliveries.map(d => d.status)
    )
  }
}

export function toAdminOrder(order: OrderWithDeliveries): AdminOrder {
  return {
    ...toPublicOrder(order, deliveryStatuses(order)),
    email: order.email,
    id: order.id,
    locale: order.locale,
    stripeSessionId: order.stripeSessionId,
    stripePaymentIntentId: order.stripePaymentIntentId,
    deliveryConsentAt: order.deliveryConsentAt.toISOString(),
    deliveries: []
  }
}
