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

/**
 * Plans the RESTORE deliveries of a won dispute (spec §5.2): one per GRANT row of the order that
 * the reversal took something from (`reversedAt` set), running exactly the commands stored on that
 * GRANT, and clears `reversedAt`. Idempotent: a second call finds nothing to restore. Callers still
 * guard it with the conditional `DISPUTED → PAID` update. Returns the new ids for enqueueing.
 */
export async function restoreOrderDeliveries(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<string[]> {
  await lockOrder(tx, orderId)
  const rows = await tx.delivery.findMany({
    where: {orderItem: {orderId}, kind: 'GRANT', reversedAt: {not: null}},
    orderBy: {id: 'asc'}
  })
  const ids: string[] = []
  for (const row of rows) {
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
  if (rows.length > 0)
    await tx.delivery.updateMany({
      where: {id: {in: rows.map(r => r.id)}},
      data: {reversedAt: null}
    })
  return ids
}
