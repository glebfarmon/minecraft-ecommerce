import {HttpException, Inject, Injectable, Logger} from '@nestjs/common'

import type {Currency, Locale} from '@shop/shared/catalog'
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  PublicOrder,
  RecentPurchases
} from '@shop/shared/orders'

import {rconReady} from '../catalog-admin/rcon/rcon-ready'
import {badGateway, badRequest, conflict, notFound} from '../common/http-errors'
import type {Prisma} from '../generated/prisma/client'
import {PAYMENTS_GATEWAY, type PaymentsGateway} from '../payments/payments-gateway'
import {PrismaService} from '../prisma/prisma.service'
import {type PricedItem, priceLines} from './order-pricing'
import {localePrefix, toPublicOrder} from './order-view'
import type {DiscountLine} from './promo/promo-rules'
import {PromoService} from './promo/promo.service'
import {newPublicId} from './public-id'
import {publicWebOrigin} from './public-origin'
import {TURNSTILE, type TurnstileVerifier} from './turnstile'

/** How many lines the storefront feed shows. */
const RECENT_PURCHASES = 10

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)
  /** Where Stripe returns the buyer. */
  private readonly origin: string

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENTS_GATEWAY) private readonly gateway: PaymentsGateway,
    @Inject(TURNSTILE) private readonly turnstile: TurnstileVerifier,
    private readonly promos: PromoService
  ) {
    this.origin = publicWebOrigin()
  }

  async create(req: CreateOrderRequest, ip: string): Promise<CreateOrderResponse> {
    if (!(await this.turnstile.verify(req.turnstileToken, ip))) throw badRequest('turnstile_failed')

    const {items, discountLines} = await this.priceRequest(req.lines, req.currency, req.locale)

    let promo: {id: string; code: string} | null = null
    let discount = 0
    if (req.promoCode !== undefined) {
      const result = await this.promos.evaluate(req.promoCode, discountLines, req.currency)
      if (!result.ok) throw conflict('promo', {reason: result.reason})
      promo = result.promo
      discount = result.discountMinor
    }
    const subtotal = items.reduce((sum, i) => sum + i.unitAmountMinor * i.quantity, 0)
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
              promoCodeId: promo?.id ?? null,
              promoCode: promo?.code ?? null,
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
            cancelUrl: `${this.origin}${prefix || '/'}`,
            discount: promo && {minor: discount, code: promo.code}
          })
          await tx.order.update({
            where: {id: order.id},
            data: {stripeSessionId: created.sessionId}
          })
          // Last, so the code's row is locked only for the commit, not the gateway round-trip.
          // Losing the race rolls the order back; the session already opened is never shown to
          // anyone and expires on its own (its webhook names an unknown order and is logged).
          if (promo && !(await this.reservePromo(tx, promo.id)))
            throw conflict('promo', {reason: 'used_up'})
          return created
        },
        {timeout: 15_000}
      )
      return {publicId, redirectUrl: session.url}
    } catch (error) {
      if (error instanceof HttpException) throw error
      this.logger.error('creating the payment session failed', error)
      throw badGateway('payments_unavailable')
    }
  }

  /**
   * Takes one use of a live code; false when it is used up, disabled or deleted. Under READ
   * COMMITTED a concurrent taker waits on the row lock and then re-checks the condition, so a
   * `maxUses` code is never over-redeemed.
   */
  private async reservePromo(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
    const updated = await tx.$executeRaw`
      UPDATE promo_codes SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
      WHERE id = ${id} AND "deletedAt" IS NULL AND "isActive"
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`
    return updated === 1
  }

  /**
   * Prices request lines from the database. Throws 409 `unavailable` when any line cannot be sold.
   * `discountLines` carry the product and category ids a promo code is matched against.
   */
  async priceRequest(
    lines: CreateOrderRequest['lines'],
    currency: Currency,
    locale: Locale
  ): Promise<{items: PricedItem[]; discountLines: DiscountLine[]}> {
    const products = await this.prisma.product.findMany({
      where: {OR: lines.map(l => ({slug: l.slug, server: {slug: l.server}}))},
      include: {server: true, prices: {where: {currency}}, translations: true},
      // products.icon is deprecated (dropped next release); never read it.
      omit: {icon: true}
    })
    const priced = priceLines(
      lines,
      products.map(p => ({...p, server: {...p.server, purchasable: rconReady(p.server)}})),
      currency,
      locale
    )
    if ('unavailable' in priced) throw conflict('unavailable', {lines: priced.unavailable})
    const categoryOf = new Map(products.map(p => [p.id, p.categoryId]))
    const discountLines = priced.items.map(i => ({
      productId: i.productId,
      categoryId: categoryOf.get(i.productId) ?? '',
      amountMinor: i.unitAmountMinor * i.quantity
    }))
    return {items: priced.items, discountLines}
  }

  async getPublic(publicId: string): Promise<PublicOrder> {
    const order = await this.prisma.order.findUnique({
      where: {publicId},
      include: {items: {orderBy: {id: 'asc'}}}
    })
    if (!order) throw notFound()
    return toPublicOrder(order)
  }

  /** The latest paid lines for the storefront feed: nick, product and amount only. */
  async recentPurchases(): Promise<RecentPurchases> {
    const items = await this.prisma.orderItem.findMany({
      where: {order: {status: {in: ['PAID', 'DELIVERED']}, paidAt: {not: null}}},
      orderBy: [{order: {paidAt: 'desc'}}, {id: 'asc'}],
      take: RECENT_PURCHASES,
      select: {
        id: true,
        quantity: true,
        unitAmountMinor: true,
        order: {select: {nick: true, currency: true, paidAt: true}},
        product: {select: {slug: true}},
        server: {select: {slug: true}}
      }
    })
    return {
      purchases: items.flatMap(({id, quantity, unitAmountMinor, order, product, server}) =>
        order.paidAt
          ? [
              {
                id,
                nick: order.nick,
                server: server.slug,
                product: product.slug,
                currency: order.currency,
                amountMinor: unitAmountMinor * quantity,
                paidAt: order.paidAt.toISOString()
              }
            ]
          : []
      )
    }
  }
}
