import {Logger} from '@nestjs/common'

import type {Prisma} from '../generated/prisma/client'
import {grantExpiry, renderCommands, shrinkGrantExpiry} from './delivery-rules'
import {settleOrderStatus} from './order-settle'

const log = new Logger('DeliveryReversal')

/** A delivery whose commands may have reached the game (spec §4.4). */
const maySend = (d: {status: string; commandsDone: number}) =>
  d.status === 'DONE' ||
  d.status === 'RUNNING' ||
  d.status === 'NEEDS_REVIEW' ||
  ((d.status === 'FAILED' || d.status === 'PENDING') && d.commandsDone > 0)

/** Byte order like Postgres' `ORDER BY`, nulls last. */
const byKey = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1

/** Lock order everywhere: the order row first, then its grants in id order. */
async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT 1 FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`
}

/** A delivery that sent nothing (spec §4.3); `cancelUnsentDeliveries` and the REVOKE planners share it. */
const UNSENT: Prisma.DeliveryWhereInput = {
  // A PENDING retry with commands already done has reached the game: it gets a REVOKE, not a cancel.
  OR: [
    {status: 'PENDING', commandsDone: 0},
    {status: 'FAILED', commandsDone: 0}
  ]
}

/**
 * Moves the order's deliveries that sent nothing (`PENDING` or `FAILED` with no command done)
 * to `CANCELLED`, so nothing new reaches the game. Returns how many it cancelled.
 */
export async function cancelUnsentDeliveries(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<number> {
  const {count} = await tx.delivery.updateMany({
    where: {
      orderItem: {orderId},
      ...UNSENT
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
 * Each order item has exactly one delivering row: its latest RESTORE when a won dispute restored
 * it, otherwise its GRANT; only that row is considered, and only if it may have sent something
 * (a RESTORE that never ran restored nothing, and its GRANT was already taken back). A non-timed
 * item gets a REVOKE (its revoke commands × quantity). A timed item gives back only its own share
 * of a grant shared with other orders: a `DONE` row shrinks `expiresAt` by `durationDays ×
 * quantity`, and the REVOKE (commands × 1) runs only when nothing is left; a row that is not
 * `DONE` never added time, so it shrinks nothing and revokes only a grant that is not live. Every
 * row it took something from gets `reversedAt`, which `restoreOrderDeliveries` reads; rows already
 * reversed are skipped. Returns the new REVOKE ids; the caller enqueues them after commit.
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
  const candidates = await tx.delivery.findMany({
    where: {orderItem: {orderId}, kind: {in: ['GRANT', 'RESTORE']}},
    include: {
      orderItem: {
        select: {
          id: true,
          quantity: true,
          product: {select: {durationDays: true, revokeCommands: true}}
        }
      }
    },
    orderBy: [{createdAt: 'asc'}, {id: 'asc'}]
  })
  const delivering = new Map<string, Reversible>()
  for (const row of candidates) {
    if (row.orderItemId === null) continue
    // Oldest first: the item's latest RESTORE replaces its GRANT.
    if (row.kind === 'RESTORE' || !delivering.has(row.orderItemId))
      delivering.set(row.orderItemId, row)
  }
  const rows = [...delivering.values()]
    .filter(r => r.reversedAt === null && maySend(r))
    // Locks shared grants in one order, so two reversals cannot deadlock.
    .sort((a, b) => byKey(a.grantId, b.grantId) || byKey(a.id, b.id))

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
  // A retry waiting for its turn after a partial send is planned above; stop its remaining
  // commands so they cannot run after the REVOKE.
  if (opts.cancelUnsent)
    await tx.delivery.updateMany({
      where: {
        orderItem: {orderId},
        kind: {in: ['GRANT', 'RESTORE']},
        status: 'PENDING',
        commandsDone: {gt: 0}
      },
      data: {status: 'CANCELLED'}
    })
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

/**
 * Plans the RESTORE deliveries of a won dispute (spec §5.2), inside the caller's transaction, under
 * the same lock order as the reversal (the order row, then grants in id order). Per row:
 * - reversed (`reversedAt` set; a GRANT, or the RESTORE of an earlier won dispute) with a REVOKE
 *   that sent nothing (`PENDING` or `FAILED` with no command done): the REVOKE becomes
 *   `CANCELLED` and no RESTORE is made, since nothing reached the game. A timed grant gets its
 *   clock back: a `DONE` row renews it like a completion (`grantExpiry` from now), a row that is not
 *   `DONE` only clears `revokedAt` (its own completion adds the time, the order is PAID again);
 * - reversed otherwise (its REVOKE may have run, or a timed item was only shrunk): a RESTORE;
 * - a `CANCELLED` GRANT (the reversal cancelled it before anything was sent): a RESTORE too, whose
 *   completion adds the bought time the original never added.
 * A RESTORE runs exactly the commands stored on the row it restores. `reversedAt` is cleared on
 * every row it handled, and a cancelled GRANT whose item already has a RESTORE is skipped, so a
 * second call creates nothing. It always ends by settling the order (`settleOrderStatus`), so a win
 * that restores nothing still delivers the order. Callers guard it with the conditional
 * `DISPUTED → PAID` update. Returns the new ids for enqueueing.
 */
export async function restoreOrderDeliveries(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date = new Date()
): Promise<string[]> {
  await lockOrder(tx, orderId)
  const rows = await tx.delivery.findMany({
    // Only a reversal cancels a GRANT, and a refund is terminal (never restored), so every
    // CANCELLED GRANT of an order that reaches here was cancelled by the dispute: no marker needed.
    where: {
      orderItem: {orderId},
      OR: [
        {kind: {in: ['GRANT', 'RESTORE']}, reversedAt: {not: null}},
        {kind: 'GRANT', status: 'CANCELLED'}
      ]
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
      if (await cancelUnsentRevoke(tx, row, now)) continue
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
  await settleOrderStatus(tx, orderId)
  return ids
}

type Restorable = Prisma.DeliveryGetPayload<{
  include: {orderItem: {select: {quantity: true; product: {select: {durationDays: true}}}}}
}>

/**
 * Cancels the item's latest REVOKE if it sent nothing; true when it did (then the item needs no
 * RESTORE). The update is conditional, so a REVOKE a worker claimed meanwhile counts as sent.
 */
async function cancelUnsentRevoke(tx: Prisma.TransactionClient, row: Restorable, now: Date) {
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
  if (row.grantId !== null) {
    // The reversal revoked the grant, yet the rank never left the game: put the clock back, or the
    // expiry job would never take it.
    await tx.$queryRaw`SELECT 1 FROM "grants" WHERE "id" = ${row.grantId} FOR UPDATE`
    const grant = await tx.grant.findUniqueOrThrow({where: {id: row.grantId}})
    const durationDays = row.orderItem?.product.durationDays
    await tx.grant.update({
      where: {id: row.grantId},
      data:
        row.status === 'DONE' && durationDays
          ? {
              expiresAt: grantExpiry(grant, now, durationDays, row.orderItem?.quantity ?? 1),
              revokedAt: null
            }
          : {revokedAt: null}
    })
  }
  return true
}
