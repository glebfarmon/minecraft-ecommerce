import type {Prisma} from '../generated/prisma/client'
import {renderCommands, shrinkGrantExpiry} from './delivery-rules'

/** A delivery whose commands may have reached the game (spec §4.4). */
const MAY_HAVE_SENT: Prisma.DeliveryWhereInput = {
  OR: [
    {status: {in: ['DONE', 'RUNNING', 'NEEDS_REVIEW']}},
    {status: 'FAILED', commandsDone: {gt: 0}}
  ]
}

/**
 * Moves the order's deliveries that sent nothing (`PENDING`, or `FAILED` with no command done)
 * to `CANCELLED`, so nothing new reaches the game. Returns how many it cancelled.
 */
export async function cancelUnsentDeliveries(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<number> {
  const {count} = await tx.delivery.updateMany({
    where: {
      orderItem: {orderId},
      OR: [{status: 'PENDING'}, {status: 'FAILED', commandsDone: 0}]
    },
    data: {status: 'CANCELLED'}
  })
  return count
}

/**
 * Plans what a refund or dispute takes back (spec §4.4, §5.1), inside the caller's transaction.
 * A timed item gives back only its own share of a grant shared with other orders; the REVOKE
 * runs only when nothing is left. Returns the new REVOKE ids; the caller enqueues them after commit.
 */
export async function reverseOrderDeliveries(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date,
  opts: {cancelUnsent: boolean}
): Promise<string[]> {
  if (opts.cancelUnsent) await cancelUnsentDeliveries(tx, orderId)
  const order = await tx.order.findUniqueOrThrow({where: {id: orderId}, select: {nick: true}})
  const grants = await tx.delivery.findMany({
    where: {orderItem: {orderId}, kind: 'GRANT', ...MAY_HAVE_SENT},
    include: {
      orderItem: {
        select: {
          id: true,
          quantity: true,
          product: {select: {durationDays: true, revokeCommands: true}}
        }
      }
    },
    // Locks shared grants in one order, so two reversals cannot deadlock.
    orderBy: [{grantId: 'asc'}, {id: 'asc'}]
  })

  const ids: string[] = []
  for (const delivery of grants) {
    const item = delivery.orderItem
    if (!item) continue
    if (delivery.grantId !== null) {
      const revoke = await shrinkGrant(tx, delivery.grantId, item, now)
      if (!revoke) continue
    }
    if (item.product.revokeCommands.length === 0) continue
    let commands: string[]
    try {
      commands = renderCommands(item.product.revokeCommands, order.nick, 1)
    } catch {
      // Such a GRANT was never sent (`invalid_nick`); never let this roll back the webhook.
      continue
    }
    const created = await tx.delivery.create({
      data: {
        orderItemId: item.id,
        serverId: delivery.serverId,
        kind: 'REVOKE',
        commands,
        ...(delivery.grantId !== null ? {grantId: delivery.grantId} : {})
      },
      select: {id: true}
    })
    ids.push(created.id)
  }
  return ids
}

/** Takes the item's time off the grant; true when the grant is now revoked and needs a REVOKE. */
async function shrinkGrant(
  tx: Prisma.TransactionClient,
  grantId: string,
  item: {quantity: number; product: {durationDays: number | null}},
  now: Date
): Promise<boolean> {
  // Other orders of the same nick may extend or shrink this grant at the same time.
  await tx.$queryRaw`SELECT 1 FROM "grants" WHERE "id" = ${grantId} FOR UPDATE`
  const grant = await tx.grant.findUniqueOrThrow({where: {id: grantId}})
  if (grant.revokedAt !== null) {
    // Already taken back (expired or reversed): only keep the clock honest.
    if (grant.expiresAt && item.product.durationDays)
      await tx.grant.update({
        where: {id: grantId},
        data: {
          expiresAt: shrinkGrantExpiry(grant.expiresAt, item.product.durationDays, item.quantity)
        }
      })
    return false
  }
  const expiresAt =
    grant.expiresAt && item.product.durationDays
      ? shrinkGrantExpiry(grant.expiresAt, item.product.durationDays, item.quantity)
      : grant.expiresAt
  if (expiresAt !== null && expiresAt > now) {
    await tx.grant.update({where: {id: grantId}, data: {expiresAt}})
    return false
  }
  await tx.grant.update({where: {id: grantId}, data: {expiresAt, revokedAt: now}})
  return true
}

/**
 * Plans the RESTORE deliveries of a won dispute (spec §5.2): one per GRANT that the reversal took
 * something from, running exactly the commands stored on that GRANT. Returns their ids.
 */
export async function restoreOrderDeliveries(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<string[]> {
  const grants = await tx.delivery.findMany({
    where: {orderItem: {orderId}, kind: 'GRANT', ...MAY_HAVE_SENT},
    orderBy: {id: 'asc'}
  })
  const revoked = await tx.delivery.findMany({
    where: {orderItem: {orderId}, kind: 'REVOKE'},
    select: {orderItemId: true}
  })
  const revokedItems = new Set(revoked.map(r => r.orderItemId))
  const ids: string[] = []
  for (const grant of grants) {
    // A timed item always lost its share of the grant; a non-timed one only if it got a REVOKE.
    if (grant.grantId === null && !revokedItems.has(grant.orderItemId)) continue
    const created = await tx.delivery.create({
      data: {
        orderItemId: grant.orderItemId,
        serverId: grant.serverId,
        kind: 'RESTORE',
        commands: grant.commands,
        ...(grant.grantId !== null ? {grantId: grant.grantId} : {})
      },
      select: {id: true}
    })
    ids.push(created.id)
  }
  return ids
}
