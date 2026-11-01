import {Inject, Injectable, Logger} from '@nestjs/common'

import {createDeliveriesForPaidOrder} from '../delivery/delivery-creation'
import {DELIVERY_QUEUE, type DeliveryQueue} from '../delivery/delivery-queue'
import {restoreOrderDeliveries, reverseOrderDeliveries} from '../delivery/delivery-reversal'
import type {Prisma} from '../generated/prisma/client'
import {MAILER, type Mailer} from '../mailer/mailer'
import {adminOrigin, mailOwners} from '../mailer/owner-mail'
import {disputeMail, orderReceiptMail} from '../mailer/templates'
import type {PaymentEvent} from '../payments/payments-gateway'
import {PrismaService} from '../prisma/prisma.service'
import {OrderRatesService} from './order-rates.service'
import {type OrderWithItems, localePrefix, toPublicOrder} from './order-view'
import {publicWebOrigin} from './public-origin'

type CheckoutEvent = Extract<PaymentEvent, {kind: 'paid' | 'failed'}>
type ChargeEvent = Extract<PaymentEvent, {kind: 'refunded' | 'dispute_opened' | 'dispute_closed'}>

/**
 * Applies verified Stripe events to orders. Stripe delivers at least once, possibly to several API
 * replicas at the same time, so each event is recorded in `processed_webhook_events` inside the
 * same transaction that changes the order, and only the transaction that actually moves an order
 * to PAID sends the receipt. Refunds and disputes follow the same rule: a conditional status update
 * first (it takes the order row lock), then the reversal or restore in the same transaction, and
 * the enqueue and owner mail after commit.
 */
@Injectable()
export class PaymentEventsService {
  private readonly log = new Logger(PaymentEventsService.name)
  private readonly origin = publicWebOrigin()

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly rates: OrderRatesService,
    @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueue
  ) {}

  async apply(event: PaymentEvent): Promise<void> {
    switch (event.kind) {
      case 'ignored':
        return
      case 'paid':
        return this.applyPaid(event)
      case 'failed':
        return this.applyFailed(event)
      case 'refunded':
        return this.applyRefunded(event)
      case 'dispute_opened':
        return this.applyDisputeOpened(event)
      case 'dispute_closed':
        return this.applyDisputeClosed(event)
    }
  }

  /**
   * Runs `fn` in one transaction with the event's dedupe row; null when the event was seen.
   * INSERT ... ON CONFLICT DO NOTHING: a replay finds the committed row and inserts nothing; a
   * concurrent duplicate waits on the primary key until the first transaction commits (then inserts
   * nothing) or rolls back (then takes over the event).
   */
  private deduped<T>(
    event: PaymentEvent,
    fn: (tx: Prisma.TransactionClient) => Promise<T | null>
  ): Promise<T | null> {
    return this.prisma.$transaction(async tx => {
      const fresh = await tx.processedWebhookEvent.createMany({
        data: [{stripeEventId: event.eventId, type: event.type}],
        skipDuplicates: true
      })
      if (fresh.count === 0) return null
      return fn(tx)
    })
  }

  /** The order of a checkout session event; null (logged) when unknown or the metadata disagrees. */
  private async orderBySession(tx: Prisma.TransactionClient, event: CheckoutEvent) {
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
    return order
  }

  /**
   * The order of a charge event. The payment intent column is indexed, not unique: no match or
   * several matches are logged and the event is acknowledged without a change.
   */
  private async orderByPaymentIntent(tx: Prisma.TransactionClient, event: ChargeEvent) {
    const [order, other] = await tx.order.findMany({
      where: {stripePaymentIntentId: event.paymentIntentId},
      select: {id: true, publicId: true, nick: true, status: true},
      take: 2
    })
    if (!order || other) {
      this.log.error(
        `webhook ${event.type}: ${order ? 'several orders' : 'no order'} for payment ${event.paymentIntentId}, ignored`
      )
      return null
    }
    return order
  }

  private async applyFailed(event: Extract<PaymentEvent, {kind: 'failed'}>): Promise<void> {
    await this.deduped(event, async tx => {
      const order = await this.orderBySession(tx, event)
      if (!order) return null
      const expired = await tx.order.updateMany({
        where: {id: order.id, status: 'PENDING'},
        data: {status: 'EXPIRED'}
      })
      if (expired.count === 1 && order.promoCodeId !== null) {
        // Give the use back; the guard keeps the counter from going below zero.
        await tx.promoCode.updateMany({
          where: {id: order.promoCodeId, usedCount: {gt: 0}},
          data: {usedCount: {decrement: 1}}
        })
      }
      return null
    })
  }

  private async applyPaid(event: Extract<PaymentEvent, {kind: 'paid'}>): Promise<void> {
    const result = await this.deduped(event, async tx => {
      const order = await this.orderBySession(tx, event)
      if (!order) return null

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
      const paidData = {
        status: 'PAID' as const,
        paidAt,
        stripePaymentIntentId: event.paymentIntentId
      }
      // PENDING first: EXPIRED only ever moves to PAID, so whatever state a concurrent expiry
      // leaves the row in, one of the two statements matches (a PENDING→PAID that finds the row
      // expired by then blocks on its lock, re-checks and falls through to EXPIRED→PAID).
      const first = await tx.order.updateMany({
        where: {id: order.id, status: 'PENDING'},
        data: paidData
      })
      let count = first.count
      if (count === 0) {
        const late = await tx.order.updateMany({
          where: {id: order.id, status: 'EXPIRED'},
          data: paidData
        })
        count = late.count
        if (count === 1 && order.promoCodeId !== null) {
          // The expiry released the use; a paid order owns it again, even past maxUses.
          await tx.promoCode.update({
            where: {id: order.promoCodeId},
            data: {usedCount: {increment: 1}}
          })
        }
      }
      if (count !== 1) return null
      const paid = {
        ...order,
        status: 'PAID' as const,
        paidAt,
        stripePaymentIntentId: event.paymentIntentId
      }
      // Same transaction as the PAID update, in both paths: no paid order without its deliveries.
      const deliveryIds = await createDeliveriesForPaidOrder(tx, paid)
      return {order: paid, deliveryIds}
    })
    if (result) {
      const {order: paidNow, deliveryIds} = result
      await this.enqueueAll(deliveryIds)
      // Not awaited: payment handling never waits for the rates source (fill logs its own failures).
      this.rates.fill(paidNow.id).catch((error: unknown) => {
        this.log.error(`exchange rate for ${paidNow.publicId} not filled`, error)
      })
      await this.sendReceipt(paidNow)
    }
  }

  /**
   * A whole refund (spec §4.4): `PAID|DELIVERED → REFUNDED`, then, unless the owner refunded
   * without taking the items back, the reversal. The conditional update takes the order row lock
   * and makes the reversal single-shot: a second refund event for the order matches no row.
   */
  private async applyRefunded(event: Extract<PaymentEvent, {kind: 'refunded'}>): Promise<void> {
    const ids = await this.deduped(event, async tx => {
      const order = await this.orderByPaymentIntent(tx, event)
      if (!order) return null
      const now = new Date()
      const moved = await tx.order.updateMany({
        where: {id: order.id, status: {in: ['PAID', 'DELIVERED']}},
        data: {status: 'REFUNDED', refundedAt: now}
      })
      if (moved.count !== 1) return this.ignored(event, order)
      // Read under the row lock. Null: refunded in the Stripe dashboard, revoked (spec §4.5).
      const {refundRevoke} = await tx.order.findUniqueOrThrow({
        where: {id: order.id},
        select: {refundRevoke: true}
      })
      this.log.log(`order ${order.publicId}: refunded, revoke ${String(refundRevoke ?? true)}`)
      if (!(refundRevoke ?? true)) return []
      return reverseOrderDeliveries(tx, order.id, now, {cancelUnsent: true})
    })
    if (ids) await this.enqueueAll(ids)
  }

  /** `PAID|DELIVERED → DISPUTED`, the items taken back, the owners mailed (spec §5.1). */
  private async applyDisputeOpened(
    event: Extract<PaymentEvent, {kind: 'dispute_opened'}>
  ): Promise<void> {
    const result = await this.deduped(event, async tx => {
      const order = await this.orderByPaymentIntent(tx, event)
      if (!order) return null
      const moved = await tx.order.updateMany({
        where: {id: order.id, status: {in: ['PAID', 'DELIVERED']}},
        data: {status: 'DISPUTED'}
      })
      if (moved.count !== 1) return this.ignored(event, order)
      const ids = await reverseOrderDeliveries(tx, order.id, new Date(), {cancelUnsent: true})
      return {order, ids}
    })
    if (!result) return
    const {order, ids} = result
    this.log.log(
      `order ${order.publicId}: dispute ${event.disputeId} opened for ${String(event.amount)} ${event.currency}, ${String(ids.length)} revoke(s) queued`
    )
    await this.enqueueAll(ids)
    await this.mailDispute(order, event)
  }

  /**
   * A won dispute: `DISPUTED → PAID` (the guard that makes the restore single-shot) and the
   * RESTOREs, which settle the order themselves. A lost one changes nothing (spec §5.2, §5.3).
   */
  private async applyDisputeClosed(
    event: Extract<PaymentEvent, {kind: 'dispute_closed'}>
  ): Promise<void> {
    const ids = await this.deduped(event, async tx => {
      const order = await this.orderByPaymentIntent(tx, event)
      if (!order) return null
      if (!event.won) {
        this.log.log(`order ${order.publicId}: dispute ${event.disputeId} lost`)
        return null
      }
      const moved = await tx.order.updateMany({
        where: {id: order.id, status: 'DISPUTED'},
        data: {status: 'PAID'}
      })
      if (moved.count !== 1) return this.ignored(event, order)
      this.log.log(`order ${order.publicId}: dispute ${event.disputeId} won`)
      return restoreOrderDeliveries(tx, order.id, new Date())
    })
    if (ids) await this.enqueueAll(ids)
  }

  /** A charge event the order's status does not allow (Review Focus 4): logged, nothing changes. */
  private ignored(event: ChargeEvent, order: {publicId: string; status: string}): null {
    this.log.warn(`webhook ${event.type}: order ${order.publicId} was ${order.status}, ignored`)
    return null
  }

  /** After commit; a mail failure never undoes the dispute handling. */
  private async mailDispute(
    order: {id: string; publicId: string; nick: string},
    event: Extract<PaymentEvent, {kind: 'dispute_opened'}>
  ): Promise<void> {
    try {
      const mail = await disputeMail(
        {
          publicId: order.publicId,
          nick: order.nick,
          adminUrl: `${adminOrigin()}/orders/${order.id}`
        },
        {id: event.disputeId, amountMinor: event.amount, currency: event.currency}
      )
      await mailOwners(
        this.prisma,
        this.mailer,
        mail,
        this.log,
        `dispute mail for ${order.publicId}`
      )
    } catch (error) {
      this.log.error(`dispute mail for ${order.publicId} not sent`, error)
    }
  }

  /** A queue outage never fails payment handling; a sweeper picks up what was not enqueued. */
  private async enqueueAll(ids: string[]): Promise<void> {
    // Concurrent: during a Redis outage each call waits for its timeout, and the webhook with it.
    const results = await Promise.allSettled(ids.map(id => this.queue.enqueue(id)))
    results.forEach((result, i) => {
      if (result.status === 'rejected')
        this.log.error(`delivery ${String(ids[i])} not enqueued`, result.reason)
    })
  }

  /** After commit, at most once per order; a mail failure never undoes the payment. */
  private async sendReceipt(order: OrderWithItems): Promise<void> {
    try {
      const statusUrl = `${this.origin}${localePrefix(order.locale)}/order/${order.publicId}`
      const mail = await orderReceiptMail(toPublicOrder(order, []), order.locale, statusUrl)
      await this.mailer.send({...mail, to: order.email})
    } catch (error) {
      this.log.error(`receipt for ${order.publicId} not sent`, error)
    }
  }
}
