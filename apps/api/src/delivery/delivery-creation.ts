import type {Prisma} from '../generated/prisma/client'
import type {OrderWithItems} from '../orders/order-view'
import {renderCommands} from './delivery-rules'

/**
 * Creates the GRANT deliveries of a paid order inside the transaction that moved it to PAID.
 * Cases are opened elsewhere and get none. Returns the new delivery ids for enqueueing after commit.
 */
export async function createDeliveriesForPaidOrder(
  tx: Prisma.TransactionClient,
  order: OrderWithItems
): Promise<string[]> {
  const products = await tx.product.findMany({
    where: {id: {in: order.items.map(i => i.productId)}},
    select: {id: true, kind: true, grantCommands: true}
  })
  const byId = new Map(products.map(p => [p.id, p]))
  const ids: string[] = []
  for (const item of order.items) {
    const product = byId.get(item.productId)
    if (!product || product.kind === 'CASE') continue
    let commands: string[]
    try {
      commands = renderCommands(product.grantCommands, order.nick, item.quantity)
    } catch {
      // Nicks are validated at order creation; never let this roll back a payment.
      const bad = await tx.delivery.create({
        data: {
          orderItemId: item.id,
          serverId: item.serverId,
          kind: 'GRANT',
          commands: [],
          status: 'NEEDS_REVIEW',
          lastError: 'invalid_nick'
        },
        select: {id: true}
      })
      ids.push(bad.id)
      continue
    }
    let grantId: string | undefined
    if (product.kind === 'TIMED') {
      const grant = await tx.grant.upsert({
        where: {
          nick_serverId_productId: {
            nick: order.nick,
            serverId: item.serverId,
            productId: product.id
          }
        },
        create: {nick: order.nick, serverId: item.serverId, productId: product.id},
        update: {}
      })
      grantId = grant.id
    }
    const delivery = await tx.delivery.create({
      data: {
        orderItemId: item.id,
        serverId: item.serverId,
        kind: 'GRANT',
        commands,
        ...(grantId ? {grantId} : {})
      },
      select: {id: true}
    })
    ids.push(delivery.id)
  }
  return ids
}
