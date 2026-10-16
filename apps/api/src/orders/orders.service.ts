import {Inject, Injectable, Logger} from '@nestjs/common'

import type {CreateOrderRequest, CreateOrderResponse, PublicOrder} from '@shop/shared/orders'

import {badGateway, badRequest, conflict, notFound} from '../common/http-errors'
import {PAYMENTS_GATEWAY, type PaymentsGateway} from '../payments/payments-gateway'
import {PrismaService} from '../prisma/prisma.service'
import {priceLines} from './order-pricing'
import {localePrefix, toPublicOrder} from './order-view'
import {newPublicId} from './public-id'
import {publicWebOrigin} from './public-origin'
import {TURNSTILE, type TurnstileVerifier} from './turnstile'

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)
  /** Where Stripe returns the buyer. */
  private readonly origin: string

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENTS_GATEWAY) private readonly gateway: PaymentsGateway,
    @Inject(TURNSTILE) private readonly turnstile: TurnstileVerifier
  ) {
    this.origin = publicWebOrigin()
  }

  async create(req: CreateOrderRequest, ip: string): Promise<CreateOrderResponse> {
    if (!(await this.turnstile.verify(req.turnstileToken, ip))) throw badRequest('turnstile_failed')

    const products = await this.prisma.product.findMany({
      where: {OR: req.lines.map(l => ({slug: l.slug, server: {slug: l.server}}))},
      include: {server: true, prices: {where: {currency: req.currency}}, translations: true}
    })
    const priced = priceLines(req.lines, products, req.currency, req.locale)
    if ('unavailable' in priced) throw conflict('unavailable', {lines: priced.unavailable})
    const {items} = priced

    const subtotal = items.reduce((sum, i) => sum + i.unitAmountMinor * i.quantity, 0)
    const discount = 0 // until 4b
    const total = subtotal - discount
    const publicId = newPublicId()
    const prefix = localePrefix(req.locale)

    try {
      const session = await this.prisma.$transaction(
        async tx => {
          const order = await tx.order.create({
            data: {
              publicId,
              nick: req.nick,
              email: req.email,
              locale: req.locale,
              currency: req.currency,
              subtotalMinor: subtotal,
              discountMinor: discount,
              totalMinor: total,
              deliveryConsentAt: new Date(),
              items: {create: items}
            }
          })
          // The gateway call stays inside the transaction: the order row and its session id
          // commit together, and a gateway failure leaves no order behind.
          const created = await this.gateway.createSession({
            orderId: order.id,
            currency: req.currency,
            email: req.email,
            locale: req.locale,
            lines: items.map(i => ({
              name: `${i.productName} (${i.serverName})`,
              unitAmountMinor: i.unitAmountMinor,
              quantity: i.quantity
            })),
            successUrl: `${this.origin}${prefix}/order/${publicId}`,
            cancelUrl: `${this.origin}${prefix || '/'}`
          })
          await tx.order.update({
            where: {id: order.id},
            data: {stripeSessionId: created.sessionId}
          })
          return created
        },
        {timeout: 15_000}
      )
      return {publicId, redirectUrl: session.url}
    } catch (error) {
      this.logger.error('creating the payment session failed', error)
      throw badGateway('payments_unavailable')
    }
  }

  async getPublic(publicId: string): Promise<PublicOrder> {
    const order = await this.prisma.order.findUnique({
      where: {publicId},
      include: {items: {orderBy: {id: 'asc'}}}
    })
    if (!order) throw notFound()
    return toPublicOrder(order)
  }
}
