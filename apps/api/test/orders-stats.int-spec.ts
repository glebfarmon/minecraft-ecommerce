import {Prisma} from '../src/generated/prisma/client'
import {convertTotals} from '../src/orders/order-rates.service'
import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
let n = 0
const DAY = 86_400_000
const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

type Stats = {
  range: string
  currency: string
  from: string
  revenueMinor: number
  previousRevenueMinor: number
  paidCount: number
  previousPaidCount: number
  averageMinor: number | null
  ltvMinor: number | null
  buyers: number
  awaitingRate: number
  expiredCount: number
  conversion: number | null
  byStatus: {status: string; count: number}[]
  byCurrency: {currency: string; count: number; totalMinor: number}[]
  daily: {day: string; totalMinor: number; paidCount: number}[]
  topProducts: {name: string; serverName: string; quantity: number}[]
}

async function order(opts: {
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED'
  currency?: 'EUR' | 'PLN'
  totalMinor?: number
  at: Date
  email?: string
  /** PLN per EUR fixed at payment; `null` = still waiting for a rate. Default 4.3000. */
  rate?: string | null
  items?: {
    productId: string
    serverId: string
    name: string
    serverName: string
    quantity: number
  }[]
}) {
  n += 1
  const paid = ['PAID', 'DELIVERED', 'REFUNDED'].includes(opts.status)
  const currency = opts.currency ?? 'EUR'
  const totalMinor = opts.totalMinor ?? 1000
  const rate = opts.rate === undefined ? '4.3000' : opts.rate
  return ctx.prisma.order.create({
    data: {
      publicId: `sta${String(n).padStart(19, '0')}`,
      nick: 'Steve',
      email: opts.email ?? 's@example.com',
      locale: 'en',
      currency,
      subtotalMinor: totalMinor,
      totalMinor,
      ...(paid && rate
        ? {
            eurPlnRate: new Prisma.Decimal(rate),
            rateDate: new Date(opts.at.getTime() - DAY),
            ...convertTotals(totalMinor, currency, rate)
          }
        : {}),
      status: opts.status,
      deliveryConsentAt: opts.at,
      createdAt: opts.at,
      paidAt: paid ? opts.at : null,
      items: opts.items
        ? {
            create: opts.items.map(i => ({
              productId: i.productId,
              serverId: i.serverId,
              productName: i.name,
              serverName: i.serverName,
              quantity: i.quantity,
              unitAmountMinor: 100
            }))
          }
        : undefined
    }
  })
}

beforeAll(async () => {
  ctx = await startOrdersApp()
})
afterAll(async () => {
  await ctx.stop()
})
beforeEach(async () => {
  await ctx.prisma.orderItem.deleteMany()
  await ctx.prisma.order.deleteMany()
})

const get = async (query = '') =>
  (await (await ctx.admin('SUPPORT')).get(`/api/admin/stats/orders${query}`).expect(200))
    .body as Stats

describe('order stats', () => {
  it('returns zeros, nulls and every day of the range on an empty database', async () => {
    const s = await get()
    expect(s.range).toBe('7d')
    expect(s.currency).toBe('EUR')
    expect(s.paidCount).toBe(0)
    expect(s.revenueMinor).toBe(0)
    expect([s.conversion, s.averageMinor, s.ltvMinor]).toEqual([null, null, null])
    expect(s.buyers).toBe(0)
    expect(s.awaitingRate).toBe(0)
    expect(s.byCurrency).toEqual([])
    expect(s.daily).toHaveLength(7)
    expect(s.daily.every(d => d.totalMinor === 0 && d.paidCount === 0)).toBe(true)
    expect(s.daily.at(-1)?.day).toBe(new Date().toISOString().slice(0, 10))
  })

  it('sums PAID and DELIVERED orders in the reporting currency, with the previous period', async () => {
    const now = new Date()
    await order({status: 'PAID', totalMinor: 1000, at: now})
    await order({status: 'PAID', currency: 'PLN', totalMinor: 4300, at: now})
    await order({status: 'DELIVERED', totalMinor: 700, at: new Date(now.getTime() - 2 * DAY)})
    await order({status: 'REFUNDED', totalMinor: 9999, at: now})
    await order({status: 'PENDING', totalMinor: 9999, at: now})
    await order({status: 'PAID', totalMinor: 300, at: new Date(now.getTime() - 9 * DAY)}) // previous 7d
    await order({
      status: 'PAID',
      currency: 'PLN',
      totalMinor: 860,
      at: new Date(now.getTime() - 10 * DAY)
    }) // previous 7d, converted to 200 EUR
    const eur = await get('?range=7d&currency=EUR')
    expect(eur.currency).toBe('EUR')
    expect(eur.revenueMinor).toBe(1000 + 1000 + 700)
    expect(eur.previousRevenueMinor).toBe(300 + 200)
    expect(eur.paidCount).toBe(3)
    expect(eur.previousPaidCount).toBe(2)
    expect(eur.averageMinor).toBe(900)
    const pln = await get('?currency=PLN')
    expect(pln.revenueMinor).toBe(4300 + 4300 + 3010)
    expect(pln.previousRevenueMinor).toBe(1290 + 860)
    const today = now.toISOString().slice(0, 10)
    expect(eur.daily.find(d => d.day === today)).toEqual({
      day: today,
      totalMinor: 2000,
      paidCount: 2
    })
    expect(pln.daily.find(d => d.day === today)).toEqual({
      day: today,
      totalMinor: 8600,
      paidCount: 2
    })
  })

  it('splits paid orders by original currency with original-currency sums', async () => {
    const now = new Date()
    await order({status: 'PAID', totalMinor: 1000, at: now})
    await order({status: 'PAID', totalMinor: 500, at: now})
    await order({status: 'PAID', currency: 'PLN', totalMinor: 4300, at: now})
    const s = await get('?currency=PLN')
    expect(s.byCurrency).toEqual(
      expect.arrayContaining([
        {currency: 'EUR', count: 2, totalMinor: 1500},
        {currency: 'PLN', count: 1, totalMinor: 4300}
      ])
    )
    expect(s.byCurrency).toHaveLength(2)
  })

  it('counts a buyer once however the email is cased and divides revenue by buyers', async () => {
    const now = new Date()
    await order({status: 'PAID', totalMinor: 1000, at: now, email: 'Alex@Example.com'})
    await order({status: 'PAID', totalMinor: 1000, at: now, email: 'alex@example.com'})
    await order({status: 'PAID', totalMinor: 1000, at: now, email: 'sam@example.com'})
    const s = await get()
    expect(s.buyers).toBe(2)
    expect(s.ltvMinor).toBe(1500)
  })

  it('leaves orders without a rate out of the sums but counts them', async () => {
    const now = new Date()
    await order({status: 'PAID', totalMinor: 1000, at: now})
    await order({status: 'PAID', totalMinor: 5000, at: now, rate: null, email: 'late@example.com'})
    const s = await get()
    expect(s.revenueMinor).toBe(1000)
    expect(s.averageMinor).toBe(1000)
    expect(s.awaitingRate).toBe(1)
    expect(s.paidCount).toBe(2)
    expect(s.buyers).toBe(1)
    expect(s.ltvMinor).toBe(1000)
    expect(s.byCurrency).toEqual([{currency: 'EUR', count: 2, totalMinor: 6000}])
  })

  it('has null average and LTV, not zero, while every paid order awaits a rate', async () => {
    await order({status: 'PAID', totalMinor: 1000, at: new Date(), rate: null})
    const s = await get()
    expect([s.revenueMinor, s.averageMinor, s.ltvMinor]).toEqual([0, null, null])
    expect([s.awaitingRate, s.paidCount]).toEqual([1, 1])
  })

  it('computes conversion as paid / (paid + expired) and counts every status', async () => {
    const now = new Date()
    await order({status: 'PAID', at: now})
    await order({status: 'EXPIRED', at: now})
    await order({status: 'EXPIRED', at: now})
    await order({status: 'PENDING', at: now})
    const s = await get()
    expect(s.expiredCount).toBe(2)
    expect(s.conversion).toBeCloseTo(1 / 3)
    expect(s.byStatus).toEqual(
      expect.arrayContaining([
        {status: 'PAID', count: 1},
        {status: 'EXPIRED', count: 2},
        {status: 'PENDING', count: 1}
      ])
    )
  })

  it('starts the range at a UTC midnight and excludes the day before it', async () => {
    const from = new Date(startOfUtcDay(new Date()).getTime() - 6 * DAY)
    await order({status: 'PAID', totalMinor: 100, at: from})
    await order({status: 'PAID', totalMinor: 100, at: new Date(from.getTime() - 1)})
    const s = await get()
    expect(s.from).toBe(from.toISOString())
    expect(s.revenueMinor).toBe(100)
  })

  it('ranks the top five products by quantity over paid orders', async () => {
    const server = await ctx.prisma.server.findFirstOrThrow()
    const products = await ctx.prisma.product.findMany({where: {serverId: server.id}, take: 6})
    const first = products[0]
    if (!first) throw new Error('the seeded catalog has no products')
    const now = new Date()
    for (const [i, p] of products.entries())
      await order({
        status: 'PAID',
        at: now,
        items: [
          {
            productId: p.id,
            serverId: server.id,
            name: `P${String(i)}`,
            serverName: server.name,
            quantity: i + 1
          }
        ]
      })
    await order({
      status: 'PENDING',
      at: now,
      items: [
        {
          productId: first.id,
          serverId: server.id,
          name: 'P0',
          serverName: server.name,
          quantity: 50
        }
      ]
    })
    const s = await get()
    expect(s.topProducts.map(p => p.quantity)).toEqual(
      [6, 5, 4, 3, 2].slice(0, Math.min(5, products.length))
    )
    expect(s.topProducts[0]?.serverName).toBe(server.name)
  })

  it('accepts 30d, rejects other ranges and needs order.read', async () => {
    expect((await get('?range=30d')).daily).toHaveLength(30)
    const admin = await ctx.admin('SUPPORT')
    await admin.get('/api/admin/stats/orders?range=1y').expect(400)
    await admin.get('/api/admin/stats/orders?currency=USD').expect(400)
    const custom = await ctx.admin({permissions: ['audit.read']})
    await custom.get('/api/admin/stats/orders').expect(403)
  })
})
