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
    const from = new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY)
    const prevFrom = new Date(from.getTime() - days * DAY)
    const revenueWhere = (gte: Date, lt: Date): Prisma.OrderWhereInput => ({
      status: {in: [...REVENUE_STATUSES]},
      paidAt: {gte, lt}
    })

    const [current, previous, byStatus, daily, top] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['currency'],
        where: revenueWhere(from, now),
        _sum: {totalMinor: true},
        _count: {_all: true}
      }),
      this.prisma.order.groupBy({
        by: ['currency'],
        where: revenueWhere(prevFrom, from),
        _sum: {totalMinor: true},
        _count: {_all: true}
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: {createdAt: {gte: from, lte: now}},
        _count: {_all: true}
      }),
      this.prisma.$queryRaw<
        {day: Date; currency: string; total: bigint; count: bigint}[]
      >(Prisma.sql`
        -- "paidAt" is a naive TIMESTAMP holding UTC; truncating it directly keeps days in UTC
        -- whatever the session TimeZone is.
        SELECT date_trunc('day', "paidAt") AS day, currency::text AS currency,
               SUM("totalMinor")::bigint AS total, COUNT(*)::bigint AS count
        FROM orders
        WHERE status IN ('PAID', 'DELIVERED') AND "paidAt" >= ${from} AND "paidAt" < ${now}
        GROUP BY 1, 2`),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'productName', 'serverName'],
        where: {order: revenueWhere(from, now)},
        _sum: {quantity: true},
        orderBy: {_sum: {quantity: 'desc'}},
        take: 5
      })
    ])

    const sum = (rows: typeof current, c: string) =>
      rows.find(r => r.currency === c)?._sum.totalMinor ?? 0
    const count = (rows: typeof current) => rows.reduce((a, r) => a + r._count._all, 0)
    const statusCount = (s: string) => byStatus.find(r => r.status === s)?._count._all ?? 0
    const paidCount = count(current)
    const expiredCount = statusCount('EXPIRED')
    const paidInRange = statusCount('PAID') + statusCount('DELIVERED')

    const dailyRows: OrderStats['daily'] = []
    for (let i = 0; i < days; i++) {
      const day = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10)
      for (const currency of CURRENCIES) {
        const row = daily.find(
          r => r.day.toISOString().slice(0, 10) === day && r.currency === currency
        )
        dailyRows.push({
          day,
          currency,
          totalMinor: Number(row?.total ?? 0),
          paidCount: Number(row?.count ?? 0)
        })
      }
    }

    return {
      range: query.range,
      from: from.toISOString(),
      to: now.toISOString(),
      revenue: CURRENCIES.map(currency => ({
        currency,
        totalMinor: sum(current, currency),
        previousMinor: sum(previous, currency)
      })),
      paidCount,
      previousPaidCount: count(previous),
      expiredCount,
      conversion:
        paidInRange + expiredCount === 0 ? null : paidInRange / (paidInRange + expiredCount),
      byStatus: byStatus.map(r => ({status: r.status, count: r._count._all})),
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
