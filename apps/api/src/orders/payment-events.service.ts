import {Inject, Injectable, Logger} from '@nestjs/common'

import {MAILER, type Mailer} from '../mailer/mailer'
import {orderReceiptMail} from '../mailer/templates'
import type {PaymentEvent} from '../payments/payments-gateway'
import {PrismaService} from '../prisma/prisma.service'
import {OrderRatesService} from './order-rates.service'
import {type OrderWithItems, localePrefix, toPublicOrder} from './order-view'
import {publicWebOrigin} from './public-origin'

/**
 * Applies verified Stripe events to orders. Stripe delivers at least once, possibly to several API
 * replicas at the same time, so each event is recorded in `processed_webhook_events` inside the
 * same transaction that changes the order, and only the transaction that actually moves an order
 * to PAID sends the receipt.
 */
@Injectable()
export class PaymentEventsService {
  private readonly log = new Logger(PaymentEventsService.name)
  private readonly origin = publicWebOrigin()

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly rates: OrderRatesService
  ) {}

  async apply(event: PaymentEvent): Promise<void> {
    if (event.kind === 'ignored') return
    const paidNow = await this.prisma.$transaction(async tx => {
      // Dedupe. INSERT ... ON CONFLICT DO NOTHING: a replay finds the committed row and inserts
      // nothing; a concurrent duplicate waits on the primary key until the first transaction
      // commits (then inserts nothing) or rolls back (then takes over the event).
      const fresh = await tx.processedWebhookEvent.createMany({
        data: [{stripeEventId: event.eventId, type: event.type}],
        skipDuplicates: true
      })
      if (fresh.count === 0) return null

      const order = await tx.order.findUnique({
        where: {stripeSessionId: event.sessionId},
        include: {items: {orderBy: {id: 'asc'}}}
      })
      if (!order) {
        this.log.warn(`webhook ${event.type} for unknown session ${event.sessionId}`)
        return null
      }
      if (event.orderId !== null && event.orderId !== order.id) {
        this.log.error(
          `webhook ${event.type}: session ${event.sessionId} names order ${event.orderId}, expected ${order.id}`
        )
        return null
      }

      if (event.kind === 'failed') {
        await tx.order.updateMany({
          where: {id: order.id, status: 'PENDING'},
          data: {status: 'EXPIRED'}
        })
        return null
      }

      // `amountTotal` is -1 when Stripe sent no amount; totals are never negative.
      if (
        event.amountTotal < 0 ||
        event.amountTotal !== order.totalMinor ||
        event.currency !== order.currency
      ) {
        this.log.error(
          `order ${order.publicId}: paid ${String(event.amountTotal)} ${event.currency}, expected ${String(order.totalMinor)} ${order.currency}`
        )
        return null
      }

      // Conditional update: when two different paid events race, the second one blocks on the
      // row lock, re-checks the WHERE against the committed PAID row and updates nothing.
      const paidAt = new Date()
      const {count} = await tx.order.updateMany({
        where: {id: order.id, status: {in: ['PENDING', 'EXPIRED']}},
        data: {status: 'PAID', paidAt}
      })
      return count === 1 ? {...order, status: 'PAID' as const, paidAt} : null
    })
    if (paidNow) {
      // Not awaited: payment handling never waits for the rates source (fill logs its own failures).
      this.rates.fill(paidNow.id).catch((error: unknown) => {
        this.log.error(`exchange rate for ${paidNow.publicId} not filled`, error)
      })
      await this.sendReceipt(paidNow)
    }
  }

  /** After commit, at most once per order; a mail failure never undoes the payment. */
  private async sendReceipt(order: OrderWithItems): Promise<void> {
    try {
      const statusUrl = `${this.origin}${localePrefix(order.locale)}/order/${order.publicId}`
      const mail = await orderReceiptMail(toPublicOrder(order), order.locale, statusUrl)
      await this.mailer.send({...mail, to: order.email})
    } catch (error) {
      this.log.error(`receipt for ${order.publicId} not sent`, error)
    }
  }
}
