import {Injectable} from '@nestjs/common'

import type {OrderStats, OrderStatsQuery} from '@shop/shared/orders'

import {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'

const CURRENCIES = ['EUR', 'PLN'] as const
const DAY = 86_400_000
const REVENUE_STATUSES = ['PAID', 'DELIVERED'] as const

const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

@Injectable()
export class OrdersStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(query: OrderStatsQuery, now = new Date()): Promise<OrderStats> {
    const days = query.range === '30d' ? 30 : 7
    const {currency} = query
    // Whitelisted column of the stored per-currency total; never user input.
    const column = Prisma.raw(currency === 'EUR' ? '"totalEurMinor"' : '"totalPlnMinor"')
    const from = new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY)
    const prevFrom = new Date(from.getTime() - days * DAY)
    const revenueWhere = (gte: Date, lt: Date): Prisma.OrderWhereInput => ({
      status: {in: [...REVENUE_STATUSES]},
      paidAt: {gte, lt}
    })
    const converted = (gte: Date, lt: Date) =>
      this.prisma.order.aggregate({
        where: {...revenueWhere(gte, lt), eurPlnRate: {not: null}},
        _sum: {totalEurMinor: true, totalPlnMinor: true},
        _count: {_all: true}
      })

    const [
      current,
      previous,
      withRate,
      previousWithRate,
      awaitingRate,
      previousAwaitingRate,
      buyers,
      byStatus,
      daily,
      top
    ] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['currency'],
        where: revenueWhere(from, now),
        _sum: {totalMinor: true},
        _count: {_all: true}
      }),
      this.prisma.order.count({where: revenueWhere(prevFrom, from)}),
      converted(from, now),
      converted(prevFrom, from),
      this.prisma.order.count({where: {...revenueWhere(from, now), eurPlnRate: null}}),
      this.prisma.order.count({where: {...revenueWhere(prevFrom, from), eurPlnRate: null}}),
      this.prisma.$queryRaw<{buyers: bigint}[]>(Prisma.sql`
          SELECT COUNT(DISTINCT lower(email))::bigint AS buyers
          FROM orders
          WHERE status IN ('PAID', 'DELIVERED') AND "paidAt" >= ${from} AND "paidAt" < ${now}
            AND "eurPlnRate" IS NOT NULL`),
      this.prisma.order.groupBy({
        by: ['status'],
        where: {createdAt: {gte: from, lte: now}},
        _count: {_all: true}
      }),
      this.prisma.$queryRaw<{day: Date; total: bigint | null; count: bigint}[]>(Prisma.sql`
          -- "paidAt" is a naive TIMESTAMP holding UTC; truncating it directly keeps days in UTC
          -- whatever the session TimeZone is.
          SELECT date_trunc('day', "paidAt") AS day,
                 SUM(${column}) FILTER (WHERE "eurPlnRate" IS NOT NULL)::bigint AS total,
                 COUNT(*)::bigint AS count
          FROM orders
          WHERE status IN ('PAID', 'DELIVERED') AND "paidAt" >= ${from} AND "paidAt" < ${now}
          GROUP BY 1`),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'productName', 'serverName'],
        where: {order: revenueWhere(from, now)},
        _sum: {quantity: true},
        orderBy: {_sum: {quantity: 'desc'}},
        take: 5
      })
    ])

    const inCurrency = (sum: {totalEurMinor: number | null; totalPlnMinor: number | null}) =>
      (currency === 'EUR' ? sum.totalEurMinor : sum.totalPlnMinor) ?? 0
    const statusCount = (st: string) => byStatus.find(r => r.status === st)?._count._all ?? 0
    const paidCount = current.reduce((a, r) => a + r._count._all, 0)
    const expiredCount = statusCount('EXPIRED')
    const paidInRange = statusCount('PAID') + statusCount('DELIVERED')
    const revenueMinor = inCurrency(withRate._sum)
    const buyerCount = Number(buyers[0]?.buyers ?? 0)

    const dailyRows: OrderStats['daily'] = []
    for (let i = 0; i < days; i++) {
      const day = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10)
      const row = daily.find(r => r.day.toISOString().slice(0, 10) === day)
      dailyRows.push({day, totalMinor: Number(row?.total ?? 0), paidCount: Number(row?.count ?? 0)})
    }

    return {
      range: query.range,
      currency,
      from: from.toISOString(),
      to: now.toISOString(),
      revenueMinor,
      previousRevenueMinor: inCurrency(previousWithRate._sum),
      paidCount,
      previousPaidCount: previous,
      averageMinor:
        withRate._count._all === 0 ? null : Math.round(revenueMinor / withRate._count._all),
      ltvMinor: buyerCount === 0 ? null : Math.round(revenueMinor / buyerCount),
      buyers: buyerCount,
      awaitingRate,
      previousAwaitingRate,
      expiredCount,
      conversion:
        paidInRange + expiredCount === 0 ? null : paidInRange / (paidInRange + expiredCount),
      byStatus: byStatus.map(r => ({status: r.status, count: r._count._all})),
      byCurrency: CURRENCIES.flatMap(c => {
        const row = current.find(r => r.currency === c)
        return row
          ? [{currency: c, count: row._count._all, totalMinor: row._sum.totalMinor ?? 0}]
          : []
      }),
      daily: dailyRows,
      topProducts: top.map(t => ({
        productId: t.productId,
        name: t.productName,
        serverName: t.serverName,
        quantity: t._sum.quantity ?? 0
      }))
    }
  }
}
