import {Inject, Injectable, Logger} from '@nestjs/common'

import {MAILER, type Mailer} from '../mailer/mailer'
import {type DeliveryAlertItem, deliveryAlertMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'

/** Emails the owners once about each FAILED / NEEDS_REVIEW delivery (spec §7). */
@Injectable()
export class DeliveryAlertService {
  private readonly log = new Logger(DeliveryAlertService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer
  ) {}

  /** Returns how many deliveries were announced. A mail failure never un-sets `alertedAt`. */
  async sendPending(): Promise<number> {
    const claimed = await this.prisma.$transaction(
      tx =>
        tx.$queryRaw<{id: string}[]>`
        UPDATE deliveries SET "alertedAt" = now()
        WHERE id IN (
          SELECT id FROM deliveries
          WHERE status IN ('FAILED', 'NEEDS_REVIEW') AND "alertedAt" IS NULL
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id`
    )
    if (claimed.length === 0) return 0
    // Outside the transaction: the include sub-queries run in parallel and need a pool.
    const deliveries = await this.prisma.delivery.findMany({
      where: {id: {in: claimed.map(row => row.id)}},
      include: {server: true, grant: true, orderItem: {include: {order: true}}},
      orderBy: {createdAt: 'asc'}
    })
    if (deliveries.length === 0) return 0

    const items: DeliveryAlertItem[] = deliveries.map(d => ({
      deliveryId: d.id,
      kind: d.kind,
      orderPublicId: d.orderItem?.order.publicId ?? null,
      nick: d.orderItem?.order.nick ?? d.grant?.nick ?? '',
      serverName: d.server.name,
      status: d.status as 'FAILED' | 'NEEDS_REVIEW',
      lastError: d.lastError
    }))
    try {
      const owners = await this.prisma.user.findMany({
        where: {disabledAt: null, role: {name: 'OWNER'}},
        select: {email: true}
      })
      const mail = await deliveryAlertMail(items, `${process.env.BETTER_AUTH_URL ?? ''}/orders`)
      for (const {email} of owners) {
        try {
          await this.mailer.send({...mail, to: email})
        } catch (error) {
          this.log.error(`delivery alert to ${email} not sent`, error)
        }
      }
    } catch (error) {
      this.log.error('delivery alert not sent', error)
    }
    return deliveries.length
  }
}
