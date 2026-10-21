import type {Locale} from '@shop/shared/catalog'
import type {AdminOrder, OrderServerGroup, PublicOrder} from '@shop/shared/orders'

import type {Order, OrderItem} from '../generated/prisma/client'
import {maskEmail} from './mask-email'

export type OrderWithItems = Order & {items: OrderItem[]}

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

export function toPublicOrder(order: OrderWithItems): PublicOrder {
  return {
    publicId: order.publicId,
    status: order.status,
    nick: order.nick,
    email: maskEmail(order.email),
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    promoCode: null,
    totalMinor: order.totalMinor,
    servers: groupByServer(order.items),
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null
  }
}

export function toAdminOrder(order: OrderWithItems): AdminOrder {
  return {
    ...toPublicOrder(order),
    email: order.email,
    id: order.id,
    locale: order.locale,
    stripeSessionId: order.stripeSessionId,
    stripePaymentIntentId: order.stripePaymentIntentId,
    deliveryConsentAt: order.deliveryConsentAt.toISOString()
  }
}
