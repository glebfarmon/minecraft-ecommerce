import {Logger} from '@nestjs/common'

import type {Prisma} from '../generated/prisma/client'
import {renderCommands, shrinkGrantExpiry} from './delivery-rules'

const log = new Logger('DeliveryReversal')

/** A delivery whose commands may have reached the game (spec §4.4). */
const MAY_HAVE_SENT: Prisma.DeliveryWhereInput = {
  OR: [
    {status: {in: ['DONE', 'RUNNING', 'NEEDS_REVIEW']}},
    {status: 'FAILED', commandsDone: {gt: 0}}
  ]
}

/** Lock order everywhere: the order row first, then its grants in id order. */
async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT 1 FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`
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

type Reversible = Prisma.DeliveryGetPayload<{
  include: {
    orderItem: {
      select: {
        id: true
        quantity: true
        product: {select: {durationDays: true; revokeCommands: true}}
      }
    }
  }
}>

/**
 * Plans what a refund or dispute takes back (spec §4.4, §5.1), inside the caller's transaction.
 * Only `GRANT` rows that may have sent something are considered. A non-timed item gets a REVOKE
 * (its revoke commands × quantity). A timed item gives back only its own share of a grant shared
 * with other orders: a `DONE` row shrinks `expiresAt` by `durationDays × quantity`, and the REVOKE
 * (commands × 1) runs only when nothing is left; a row that is not `DONE` never added time, so it
 * shrinks nothing and revokes only a grant that is not live. Every GRANT row it took something
 * from gets `reversedAt`, which `restoreOrderDeliveries` reads; rows already reversed are skipped.
 * Returns the new REVOKE ids; the caller enqueues them after commit.
 */
export async function reverseOrderDeliveries(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date,
  opts: {cancelUnsent: boolean}
): Promise<string[]> {
  await lockOrder(tx, orderId)
  if (opts.cancelUnsent) await cancelUnsentDeliveries(tx, orderId)
  const order = await tx.order.findUniqueOrThrow({where: {id: orderId}, select: {nick: true}})
  const rows = await tx.delivery.findMany({
    where: {orderItem: {orderId}, kind: 'GRANT', reversedAt: null, ...MAY_HAVE_SENT},
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
  for (const row of rows) {
    const item = row.orderItem
    if (!item) continue
    const timed = row.grantId !== null
    let commands: string[]
    try {
      commands = renderCommands(item.product.revokeCommands, order.nick, timed ? 1 : item.quantity)
    } catch (error) {
      // Rendered before touching the grant: a skipped item leaves no half state.
      log.error(`delivery ${row.id}: revoke commands not rendered, item skipped`, error)
      continue
    }
    const share =
      row.grantId === null
        ? {revoke: true, shrunk: false}
        : await takeGrantShare(tx, row, row.grantId, now)
    let revokeId: string | undefined
    if (share.revoke && commands.length > 0) {
      const created = await tx.delivery.create({
        data: {
          orderItemId: item.id,
          serverId: row.serverId,
          kind: 'REVOKE',
          commands,
          ...(row.grantId !== null ? {grantId: row.grantId} : {})
        },
        select: {id: true}
      })
      revokeId = created.id
      ids.push(created.id)
    }
    // Something was taken: a REVOKE was created or time came off a DONE grant.
    if (revokeId !== undefined || share.shrunk)
      await tx.delivery.update({where: {id: row.id}, data: {reversedAt: now}})
  }
  return ids
}

/**
 * Takes the row's share of its grant. `revoke`: the grant is now revoked and needs a REVOKE;
 * `shrunk`: this row's time came off the clock.
 */
async function takeGrantShare(
  tx: Prisma.TransactionClient,
  row: Reversible,
  grantId: string,
  now: Date
): Promise<{revoke: boolean; shrunk: boolean}> {
  await tx.$queryRaw`SELECT 1 FROM "grants" WHERE "id" = ${grantId} FOR UPDATE`
  const grant = await tx.grant.findUniqueOrThrow({where: {id: grantId}})
  // Already taken back (expired or reversed by another order): nothing left to take.
  if (grant.revokedAt !== null) return {revoke: false, shrunk: false}
  const durationDays = row.orderItem?.product.durationDays
  const quantity = row.orderItem?.quantity ?? 1
  if (row.status === 'DONE') {
    // Only a completed GRANT added its time to the clock (`complete()`).
    const shrunk = grant.expiresAt !== null && !!durationDays
    const expiresAt =
      grant.expiresAt && durationDays
        ? shrinkGrantExpiry(grant.expiresAt, durationDays, quantity)
        : grant.expiresAt
    if (expiresAt !== null && expiresAt > now) {
      await tx.grant.update({where: {id: grantId}, data: {expiresAt}})
      return {revoke: false, shrunk}
    }
    await tx.grant.update({where: {id: grantId}, data: {expiresAt, revokedAt: now}})
    return {revoke: true, shrunk}
  }
  // Not DONE: no time of ours is on the clock; a live grant belongs to another order.
  if (grant.expiresAt !== null && grant.expiresAt > now) return {revoke: false, shrunk: false}
  await tx.grant.update({where: {id: grantId}, data: {revokedAt: now}})
  return {revoke: true, shrunk: false}
}

/** A REVOKE that sent nothing yet; the same filter `cancelUnsentDeliveries` uses. */
const UNSENT: Prisma.DeliveryWhereInput = {
  OR: [{status: 'PENDING'}, {status: 'FAILED', commandsDone: 0}]
}

/**
 * Plans the RESTORE deliveries of a won dispute (spec §5.2), inside the caller's transaction, under
 * the same lock order as the reversal (the order row, then grants in id order). Per GRANT row:
 * - reversed (`reversedAt` set) with a REVOKE that sent nothing (`PENDING`, or `FAILED` with no
 *   command done): the REVOKE becomes `CANCELLED` and no RESTORE is made, since nothing reached the
 *   game; a timed `DONE` row gets the share the reversal shrank back (`revokedAt` cleared; the
 *   expiry job takes the grant back if that time has run out meanwhile);
 * - reversed otherwise (its REVOKE may have run, or a timed item was only shrunk): a RESTORE;
 * - `CANCELLED` (the reversal cancelled it before anything was sent): a RESTORE too, whose
 *   completion adds the bought time the original never added.
 * A RESTORE runs exactly the commands stored on its GRANT. `reversedAt` is cleared on every row it
 * handled, and a cancelled GRANT whose item already has a RESTORE is skipped, so a second call
 * creates nothing. Callers still guard it with the conditional `DISPUTED → PAID` update.
 * Returns the new ids for enqueueing.
 */
export async function restoreOrderDeliveries(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<string[]> {
  await lockOrder(tx, orderId)
  const rows = await tx.delivery.findMany({
    // Only a reversal cancels a GRANT, and a refund is terminal (never restored), so every
    // CANCELLED GRANT of an order that reaches here was cancelled by the dispute: no marker needed.
    where: {
      orderItem: {orderId},
      kind: 'GRANT',
      OR: [{reversedAt: {not: null}}, {status: 'CANCELLED'}]
    },
    include: {
      orderItem: {select: {quantity: true, product: {select: {durationDays: true}}}}
    },
    // Locks shared grants in one order, as the reversal does.
    orderBy: [{grantId: 'asc'}, {id: 'asc'}]
  })
  const ids: string[] = []
  for (const row of rows) {
    if (row.reversedAt === null) {
      const restored = await tx.delivery.count({
        where: {orderItemId: row.orderItemId, kind: 'RESTORE'}
      })
      if (restored > 0) continue
    } else {
      await tx.delivery.update({where: {id: row.id}, data: {reversedAt: null}})
      if (await cancelUnsentRevoke(tx, row)) continue
    }
    const created = await tx.delivery.create({
      data: {
        orderItemId: row.orderItemId,
        serverId: row.serverId,
        kind: 'RESTORE',
        commands: row.commands,
        ...(row.grantId !== null ? {grantId: row.grantId} : {})
      },
      select: {id: true}
    })
    ids.push(created.id)
  }
  return ids
}

type Restorable = Prisma.DeliveryGetPayload<{
  include: {orderItem: {select: {quantity: true; product: {select: {durationDays: true}}}}}
}>

/**
 * Cancels the item's latest REVOKE if it sent nothing; true when it did (then the item needs no
 * RESTORE). The update is conditional, so a REVOKE a worker claimed meanwhile counts as sent.
 */
async function cancelUnsentRevoke(tx: Prisma.TransactionClient, row: Restorable) {
  if (row.orderItemId === null) return false
  const revoke = await tx.delivery.findFirst({
    where: {orderItemId: row.orderItemId, kind: 'REVOKE', status: {not: 'CANCELLED'}},
    orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
    select: {id: true}
  })
  if (!revoke) return false
  const {count} = await tx.delivery.updateMany({
    where: {id: revoke.id, ...UNSENT},
    data: {status: 'CANCELLED'}
  })
  if (count !== 1) return false
  const durationDays = row.orderItem?.product.durationDays
  if (row.grantId !== null && row.status === 'DONE' && durationDays) {
    // The reversal shrank this row's share off the clock and revoked the grant: give it back.
    await tx.$queryRaw`SELECT 1 FROM "grants" WHERE "id" = ${row.grantId} FOR UPDATE`
    const grant = await tx.grant.findUniqueOrThrow({where: {id: row.grantId}})
    if (grant.expiresAt !== null)
      await tx.grant.update({
        where: {id: row.grantId},
        data: {
          expiresAt: shrinkGrantExpiry(
            grant.expiresAt,
            -durationDays,
            row.orderItem?.quantity ?? 1
          ),
          revokedAt: null
        }
      })
  }
  return true
}
