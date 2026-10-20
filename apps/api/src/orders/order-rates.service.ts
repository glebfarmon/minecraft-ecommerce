import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy
} from '@nestjs/common'

import {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {EXCHANGE_RATES, type ExchangeRates} from '../rates/exchange-rates'
import {warsawDay} from '../rates/warsaw-day'

const SWEEP_EVERY_MS = 60 * 60 * 1000

/** The order total in both currencies, rounded half-up to minor units. `rate` is PLN per EUR. */
export function convertTotals(
  totalMinor: number,
  currency: 'EUR' | 'PLN',
  rate: string
): {totalEurMinor: number; totalPlnMinor: number} {
  const round = (value: Prisma.Decimal) =>
    value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber()
  return currency === 'EUR'
    ? {totalEurMinor: totalMinor, totalPlnMinor: round(new Prisma.Decimal(totalMinor).mul(rate))}
    : {totalEurMinor: round(new Prisma.Decimal(totalMinor).div(rate)), totalPlnMinor: totalMinor}
}

/**
 * Fixes the EUR→PLN rate of a paid order, once. Runs after the payment commit (ADR 0010), so a
 * rates outage never touches payment handling: the order keeps null fields and the hourly sweep
 * (which also backfills orders paid before this existed) fills them later.
 */
@Injectable()
export class OrderRatesService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(OrderRatesService.name)
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXCHANGE_RATES) private readonly rates: ExchangeRates
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return
    void this.sweep()
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    clearInterval(this.timer)
  }

  async fill(
    orderId: string,
    lookup: ExchangeRates['eurPlnBefore'] = day => this.rates.eurPlnBefore(day)
  ): Promise<'filled' | 'pending' | 'skipped'> {
    const order = await this.prisma.order.findUnique({
      where: {id: orderId},
      select: {paidAt: true, currency: true, totalMinor: true, eurPlnRate: true}
    })
    if (!order?.paidAt || order.eurPlnRate) return 'skipped'
    let found
    try {
      found = await lookup(warsawDay(order.paidAt))
    } catch (error) {
      this.log.warn(`no exchange rate for order ${orderId} yet: ${String(error)}`)
      return 'pending'
    }
    if (!found) {
      this.log.warn(`no exchange-rate table before the payment day of order ${orderId}`)
      return 'pending'
    }
    // Conditional on a still-null rate: replicas filling the same order write the first value only.
    const {count} = await this.prisma.order.updateMany({
      where: {id: orderId, eurPlnRate: null},
      data: {
        eurPlnRate: new Prisma.Decimal(found.rate),
        rateDate: new Date(found.date),
        ...convertTotals(order.totalMinor, order.currency, found.rate)
      }
    })
    return count === 1 ? 'filled' : 'skipped'
  }

  /**
   * Fills every paid order still missing a rate, newest first (the range the dashboard shows
   * comes back first), in batches of `limit`. One request per day however many orders share it;
   * an order that stays pending is not retried within the same sweep.
   */
  async sweep(limit = 200): Promise<void> {
    const days = new Map<string, ReturnType<ExchangeRates['eurPlnBefore']>>()
    const lookup: ExchangeRates['eurPlnBefore'] = day => {
      let answer = days.get(day)
      if (!answer) {
        answer = this.rates.eurPlnBefore(day)
        days.set(day, answer)
      }
      return answer
    }
    const tried: string[] = []
    try {
      for (;;) {
        const orders = await this.prisma.order.findMany({
          where: {
            status: {in: ['PAID', 'DELIVERED']},
            paidAt: {not: null},
            eurPlnRate: null,
            id: {notIn: tried}
          },
          orderBy: {paidAt: 'desc'},
          take: limit,
          select: {id: true}
        })
        if (orders.length === 0) return
        for (const {id} of orders) {
          tried.push(id)
          await this.fill(id, lookup)
        }
      }
    } catch (error) {
      this.log.error('exchange-rate sweep failed', error)
    }
  }
}
