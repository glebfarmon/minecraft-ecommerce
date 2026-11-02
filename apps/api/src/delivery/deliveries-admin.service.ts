import {Inject, Injectable, Logger} from '@nestjs/common'

import type {AdminDelivery, AdminDeliveryPage, AdminDeliveryQuery} from '@shop/shared/delivery'

import {conflict, notFound} from '../common/http-errors'
import {PrismaService} from '../prisma/prisma.service'
import {DELIVERY_QUEUE, type DeliveryQueue} from './delivery-queue'
import {toAdminDelivery} from './delivery-view'
import {DeliveryService} from './delivery.service'

const PAGE = 50
const STUCK = ['FAILED', 'NEEDS_REVIEW'] as const
const notStuck = () => conflict('delivery_not_stuck')
/**
 * A GRANT or RESTORE of a refunded or disputed order: its items were taken back, so giving them
 * out again is not a retry. Its REVOKE rows stay retryable, and Mark as done stays for the owner.
 */
const REVERSED_GRANT = {
  kind: {in: ['GRANT' as const, 'RESTORE' as const]},
  orderItem: {order: {status: {in: ['REFUNDED' as const, 'DISPUTED' as const]}}}
}

/** The owner's two ways out of a stuck delivery (spec §7): run it again, or confirm it by hand. */
@Injectable()
export class DeliveriesAdminService {
  private readonly log = new Logger(DeliveriesAdminService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveries: DeliveryService,
    @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueue
  ) {}

  /** The deliveries a human has to look at, newest first, of every kind. */
  async page(query: AdminDeliveryQuery): Promise<AdminDeliveryPage> {
    const where = {status: {in: [...STUCK]}}
    const [rows, attentionCount] = await Promise.all([
      this.prisma.delivery.findMany({
        where,
        orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
        take: PAGE + 1,
        ...(query.cursor ? {cursor: {id: query.cursor}, skip: 1} : {}),
        include: {
          server: {select: {name: true}},
          orderItem: {
            select: {
              productName: true,
              order: {select: {id: true, publicId: true, nick: true, status: true}}
            }
          },
          grant: {
            select: {
              nick: true,
              product: {select: {translations: {select: {locale: true, name: true}}}}
            }
          }
        }
      }),
      this.prisma.delivery.count({where})
    ])
    const deliveries = rows.slice(0, PAGE).map(row => {
      const order = row.orderItem?.order ?? null
      const names = row.grant?.product.translations ?? []
      // An expiry revoke has no item snapshot: the grant's product in English, else any language.
      const grantName = (names.find(n => n.locale === 'en') ?? names[0])?.name
      const productName = row.orderItem?.productName ?? grantName ?? null
      return {
        ...toAdminDelivery(row, productName),
        nick: order?.nick ?? row.grant?.nick ?? '',
        orderId: order?.id ?? null,
        orderPublicId: order?.publicId ?? null,
        orderStatus: order?.status ?? null
      }
    })
    return {
      deliveries,
      nextCursor: rows.length > PAGE ? (deliveries.at(-1)?.id ?? null) : null,
      attentionCount
    }
  }

  async retry(id: string, onBefore: (before: AdminDelivery) => void): Promise<AdminDelivery> {
    onBefore(await this.view(id))
    // A nick that cannot be rendered left no commands; running it again would "succeed" silently.
    const unrenderable = await this.prisma.delivery.count({
      where: {id, commands: {isEmpty: true}, lastError: 'invalid_nick'}
    })
    if (unrenderable > 0) throw conflict('delivery_not_retryable')
    const moved = await this.prisma.$transaction(async tx => {
      // The order first (lock order of `delivery-reversal.ts`), so a refund or dispute cannot
      // land between the check below and the update.
      await this.deliveries.lockOrderOf(tx, id)
      const updated = await tx.delivery.updateMany({
        where: {id, status: {in: [...STUCK]}, NOT: REVERSED_GRANT},
        // lastError, commandsDone and alertedAt stay: the alert is not repeated for this episode.
        data: {status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), startedAt: null}
      })
      if (updated.count === 1) return 'moved'
      const reversed = await tx.delivery.count({
        where: {id, status: {in: [...STUCK]}, ...REVERSED_GRANT}
      })
      return reversed > 0 ? 'reversed' : 'not_stuck'
    })
    if (moved === 'reversed') throw conflict('delivery_order_reversed')
    if (moved === 'not_stuck') throw notStuck()
    try {
      await this.queue.enqueue(id)
    } catch (error) {
      // The sweeper picks a due PENDING delivery up anyway.
      this.log.error(`delivery ${id} not enqueued after retry`, error)
    }
    return this.view(id)
  }

  async markDone(id: string, onBefore: (before: AdminDelivery) => void): Promise<AdminDelivery> {
    onBefore(await this.view(id))
    const completed = await this.prisma.$transaction(async tx => {
      // The order first (lock order of `delivery-reversal.ts`), then the conditional guard takes
      // the row lock; `complete` then finishes it like a worker would.
      await this.deliveries.lockOrderOf(tx, id)
      const claimed = await tx.delivery.updateMany({
        where: {id, status: {in: [...STUCK]}},
        data: {status: 'RUNNING'}
      })
      if (claimed.count !== 1) return false
      await this.deliveries.complete(tx, id)
      return true
    })
    if (!completed) throw notStuck()
    return this.view(id)
  }

  private async view(id: string): Promise<AdminDelivery> {
    const row = await this.prisma.delivery.findUnique({
      where: {id},
      include: {server: {select: {name: true}}, orderItem: {select: {productName: true}}}
    })
    if (!row) throw notFound()
    return toAdminDelivery(row, row.orderItem?.productName ?? null)
  }
}
