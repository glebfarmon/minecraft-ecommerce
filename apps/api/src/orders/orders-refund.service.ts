import {Inject, Injectable, Logger} from '@nestjs/common'

import type {AdminOrder} from '@shop/shared/orders'

import {badGateway, conflict, notFound} from '../common/http-errors'
import {cancelUnsentDeliveries} from '../delivery/delivery-reversal'
import type {Prisma} from '../generated/prisma/client'
import {PAYMENTS_GATEWAY, type PaymentsGateway} from '../payments/payments-gateway'
import {PrismaService} from '../prisma/prisma.service'
import {ORDER_ITEMS_WITH_ADMIN_DELIVERY, toAdminOrder} from './order-view'

/** A refund request older than this counts as lost; the owner may ask again (same Stripe key). */
export const REFUND_RETRY_AFTER_MS = 15 * 60_000

const REFUNDABLE = ['PAID', 'DELIVERED'] as const

const lockOrder = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT 1 FROM "orders" WHERE "id" = ${id} FOR UPDATE`

/** The owner's refund (spec §3): reserve, call the payment provider, optionally cancel unsent deliveries. */
@Injectable()
export class OrdersRefundService {
  private readonly log = new Logger(OrdersRefundService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENTS_GATEWAY) private readonly gateway: PaymentsGateway
  ) {}

  async refund(
    id: string,
    revoke: boolean,
    onBefore: (before: AdminOrder) => void
  ): Promise<AdminOrder> {
    onBefore(await this.view(id))
    const reservedAt = new Date()
    // The order lock serialises refund requests: the state check and the reservation cannot race
    // with another refund. A delivery that starts after the check is harmless: with `revoke` the
    // refund webhook reverses it, without `revoke` it is kept by design.
    const reservation = await this.prisma.$transaction(async tx => {
      await lockOrder(tx, id)
      const order = await tx.order.findUnique({
        where: {id},
        select: {
          status: true,
          stripePaymentIntentId: true,
          refundRequestedAt: true,
          refundRevoke: true
        }
      })
      if (!order) throw notFound()
      const pi = order.stripePaymentIntentId
      if (!(REFUNDABLE as readonly string[]).includes(order.status) || pi === null)
        throw conflict('refund_not_allowed')
      const previous = {at: order.refundRequestedAt, revoke: order.refundRevoke}
      const open = await tx.delivery.count({
        where: {orderItem: {orderId: id}, status: {in: ['RUNNING', 'NEEDS_REVIEW']}}
      })
      if (open > 0) throw conflict('refund_delivery_open')
      const reserved = await tx.order.updateMany({
        where: {
          id,
          status: {in: [...REFUNDABLE]},
          OR: [
            {refundRequestedAt: null},
            {refundRequestedAt: {lt: new Date(reservedAt.getTime() - REFUND_RETRY_AFTER_MS)}}
          ]
        },
        data: {refundRequestedAt: reservedAt, refundRevoke: revoke}
      })
      if (reserved.count !== 1) throw conflict('refund_already_requested')
      return {pi, previous}
    })
    const paymentIntentId = reservation.pi

    try {
      await Promise.resolve().then(() => this.gateway.refund(paymentIntentId, `refund-${id}`))
    } catch (error) {
      this.log.error(`refund of order ${id} failed at the gateway`, error)
      // Back to what was there before, and only if the reservation is still ours.
      await this.prisma.order.updateMany({
        where: {id, refundRequestedAt: reservedAt},
        data: {
          refundRequestedAt: reservation.previous.at,
          refundRevoke: reservation.previous.revoke
        }
      })
      throw badGateway('refund_failed')
    }

    if (revoke) {
      try {
        await this.prisma.$transaction(async tx => {
          await lockOrder(tx, id)
          await cancelUnsentDeliveries(tx, id)
        })
      } catch (error) {
        // The money moved, so the request succeeded. The Stripe `refunded` webhook cancels the
        // unsent deliveries too, so the state heals itself.
        this.log.error(`order ${id}: refunded, but unsent deliveries were not cancelled`, error)
      }
    }
    return this.view(id)
  }

  private async view(id: string): Promise<AdminOrder> {
    const order = await this.prisma.order.findUnique({
      where: {id},
      include: ORDER_ITEMS_WITH_ADMIN_DELIVERY
    })
    if (!order) throw notFound()
    return toAdminOrder(order)
  }
}
