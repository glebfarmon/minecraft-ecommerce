import {Inject, Injectable, Logger} from '@nestjs/common'

import {decryptRconPassword, rconKey} from '../catalog-admin/rcon/rcon-crypto'
import {resolveRconHost} from '../catalog-admin/rcon/rcon-host'
import type {RconTarget} from '../catalog-admin/rcon/rcon-tester'
import type {Prisma, Server} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {DELIVERY_QUEUE, type DeliveryQueue} from './delivery-queue'
import {type SendOutcome, decideNext, grantExpiry} from './delivery-rules'
import {RCON_SENDER, type RconSender} from './rcon-sender'

/** How long one connection may take to sign in, and each command to be answered. */
export const RCON_TIMEOUT_MS = 10_000

type TargetResult = {target: RconTarget} | {error: string}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))
const logOf = (value: Prisma.JsonValue): Prisma.InputJsonValue[] =>
  Array.isArray(value) ? (value as Prisma.InputJsonValue[]) : []

/**
 * Runs one delivery over RCON and records the outcome (spec §4). A delivery is claimed with a
 * conditional `PENDING → RUNNING` update, so a duplicate job or a second worker does nothing.
 */
@Injectable()
export class DeliveryService {
  private readonly log = new Logger(DeliveryService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RCON_SENDER) private readonly sender: RconSender,
    @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueue
  ) {}

  async process(deliveryId: string): Promise<void> {
    // The claim time is this run's ownership token: the sweeper and Retry clear `startedAt`, so a
    // run that was taken over never matches the final write, even after a newer run claimed it.
    const claimedAt = new Date()
    const claimed = await this.prisma.delivery.updateMany({
      where: {id: deliveryId, status: 'PENDING'},
      data: {status: 'RUNNING', startedAt: claimedAt}
    })
    if (claimed.count !== 1) return
    const delivery = await this.prisma.delivery.findUniqueOrThrow({
      where: {id: deliveryId},
      include: {server: true}
    })
    const remaining = delivery.commands.slice(delivery.commandsDone)
    const outcome = await this.send(delivery.server, remaining)

    const now = new Date()
    const next = decideNext(delivery.attempts, outcome, now)
    const stored = await this.prisma.$transaction(async tx => {
      const updated = await tx.delivery.updateMany({
        where: {id: deliveryId, status: 'RUNNING', startedAt: claimedAt},
        data: {
          // DONE is set by `complete`, together with the grant clock and the order status.
          status: next.status === 'DONE' ? 'RUNNING' : next.status,
          attempts: next.attempts,
          lastError: next.lastError,
          ...(next.nextAttemptAt ? {nextAttemptAt: next.nextAttemptAt} : {}),
          commandsDone: delivery.commandsDone + outcome.replies.length,
          responseLog: [...logOf(delivery.responseLog), ...outcome.replies],
          startedAt: null
        }
      })
      if (updated.count !== 1) return false
      if (next.status === 'DONE') await this.complete(tx, deliveryId)
      return true
    })
    if (!stored) {
      // The stale-RUNNING sweeper took it over (and maybe a newer run owns it now); a human reviews it.
      this.log.warn(`delivery ${deliveryId} changed while running; outcome ${outcome.kind} dropped`)
      return
    }
    if (next.status === 'PENDING' && next.nextAttemptAt) {
      try {
        await this.queue.enqueue(deliveryId, Math.max(0, next.nextAttemptAt.getTime() - Date.now()))
      } catch (error) {
        this.log.error(`delivery ${deliveryId} not re-enqueued`, error)
      }
    }
  }

  /**
   * Marks a delivery DONE; idempotent. A GRANT of a timed product starts or extends its grant's
   * clock, and an order whose deliveries are all DONE becomes DELIVERED.
   */
  async complete(tx: Prisma.TransactionClient, deliveryId: string): Promise<void> {
    const marked = await tx.delivery.updateMany({
      where: {id: deliveryId, status: {not: 'DONE'}},
      data: {status: 'DONE', startedAt: null, lastError: null}
    })
    if (marked.count !== 1) return
    const delivery = await tx.delivery.findUniqueOrThrow({
      where: {id: deliveryId},
      include: {orderItem: {include: {product: {select: {durationDays: true}}}}}
    })
    const item = delivery.orderItem

    if (delivery.kind === 'GRANT' && delivery.grantId !== null) {
      const durationDays = item?.product.durationDays
      if (item && durationDays) {
        // Two purchases of one product finishing together must both extend the clock.
        await tx.$queryRaw`SELECT 1 FROM "grants" WHERE "id" = ${delivery.grantId} FOR UPDATE`
        const grant = await tx.grant.findUniqueOrThrow({where: {id: delivery.grantId}})
        await tx.grant.update({
          where: {id: grant.id},
          data: {
            expiresAt: grantExpiry(grant, new Date(), durationDays, item.quantity),
            revokedAt: null
          }
        })
      } else {
        this.log.error(`delivery ${deliveryId}: grant ${delivery.grantId} has no duration`)
      }
    }

    if (item) {
      // Serializes the last two deliveries of one order, so one of them sees both DONE.
      await tx.$queryRaw`SELECT 1 FROM "orders" WHERE "id" = ${item.orderId} FOR UPDATE`
      const open = await tx.delivery.count({
        where: {orderItem: {orderId: item.orderId}, status: {not: 'DONE'}}
      })
      if (open === 0)
        await tx.order.updateMany({
          where: {id: item.orderId, status: 'PAID'},
          data: {status: 'DELIVERED'}
        })
    }
  }

  /** Never throws: anything that keeps the commands from being written is `retryable`. */
  private async send(server: Server, commands: string[]): Promise<SendOutcome> {
    if (commands.length === 0) return {kind: 'done', replies: []}
    const resolved = await this.target(server)
    if ('error' in resolved) return {kind: 'retryable', replies: [], error: resolved.error}
    try {
      return await this.sender.send(resolved.target, commands, RCON_TIMEOUT_MS)
    } catch (error) {
      // The sender should not throw; if it does, a command may already have run.
      this.log.error(`rcon sender failed on server ${server.id}`, error)
      return {kind: 'unconfirmed', replies: [], error: messageOf(error)}
    }
  }

  private async target(server: Server): Promise<TargetResult> {
    if (!server.isActive) return {error: 'server_disabled'}
    const {rconHost: host, rconPort: port, rconPasswordEnc: stored} = server
    if (!host || !port || !stored) return {error: 'rcon_not_configured'}
    try {
      const password = decryptRconPassword(stored, rconKey())
      const address = await resolveRconHost(host)
      return {target: {host: address, port, password}}
    } catch (error) {
      this.log.warn(`rcon for server ${server.id} unavailable: ${messageOf(error)}`)
      return {error: 'rcon_unavailable'}
    }
  }
}
