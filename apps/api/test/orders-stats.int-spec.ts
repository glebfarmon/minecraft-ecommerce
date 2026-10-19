import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
let n = 0
const DAY = 86_400_000
const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

type Stats = {
  range: string
  from: string
  revenue: {currency: string; totalMinor: number; previousMinor: number}[]
  paidCount: number
  previousPaidCount: number
  expiredCount: number
  conversion: number | null
  byStatus: {status: string; count: number}[]
  daily: {day: string; currency: string; totalMinor: number; paidCount: number}[]
  topProducts: {name: string; serverName: string; quantity: number}[]
}

async function order(opts: {
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED'
  currency?: 'EUR' | 'PLN'
  totalMinor?: number
  at: Date
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
  return ctx.prisma.order.create({
    data: {
      publicId: `sta${String(n).padStart(19, '0')}`,
      nick: 'Steve',
      email: 's@example.com',
      locale: 'en',
      currency: opts.currency ?? 'EUR',
      subtotalMinor: opts.totalMinor ?? 1000,
      totalMinor: opts.totalMinor ?? 1000,
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
  it('returns zeros, null conversion and every day of the range on an empty database', async () => {
    const s = await get()
    expect(s.range).toBe('7d')
    expect(s.paidCount).toBe(0)
    expect(s.conversion).toBeNull()
    expect(s.revenue).toEqual([
      {currency: 'EUR', totalMinor: 0, previousMinor: 0},
      {currency: 'PLN', totalMinor: 0, previousMinor: 0}
    ])
    expect(new Set(s.daily.map(d => d.day)).size).toBe(7)
    expect(s.daily).toHaveLength(14) // 7 days × 2 currencies
    expect(s.daily.every(d => d.totalMinor === 0 && d.paidCount === 0)).toBe(true)
    expect(s.daily.at(-1)?.day).toBe(new Date().toISOString().slice(0, 10))
  })

  it('counts revenue per currency from PAID and DELIVERED only, with the previous period', async () => {
    const now = new Date()
    await order({status: 'PAID', totalMinor: 500, at: now})
    await order({status: 'DELIVERED', totalMinor: 700, at: new Date(now.getTime() - 2 * DAY)})
    await order({status: 'PAID', currency: 'PLN', totalMinor: 2000, at: now})
    await order({status: 'REFUNDED', totalMinor: 9999, at: now})
    await order({status: 'PENDING', totalMinor: 9999, at: now})
    await order({status: 'PAID', totalMinor: 300, at: new Date(now.getTime() - 9 * DAY)}) // previous 7d
    const s = await get('?range=7d')
    expect(s.revenue).toEqual([
      {currency: 'EUR', totalMinor: 1200, previousMinor: 300},
      {currency: 'PLN', totalMinor: 2000, previousMinor: 0}
    ])
    expect(s.paidCount).toBe(3)
    expect(s.previousPaidCount).toBe(1)
    const today = now.toISOString().slice(0, 10)
    expect(s.daily.find(d => d.day === today && d.currency === 'EUR')).toEqual({
      day: today,
      currency: 'EUR',
      totalMinor: 500,
      paidCount: 1
    })
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
    expect(s.revenue[0]?.totalMinor).toBe(100)
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
    expect((await get('?range=30d')).daily).toHaveLength(60)
    const admin = await ctx.admin('SUPPORT')
    await admin.get('/api/admin/stats/orders?range=1y').expect(400)
    const custom = await ctx.admin({permissions: ['audit.read']})
    await custom.get('/api/admin/stats/orders').expect(403)
  })
})
