import {readFileSync} from 'node:fs'
import path from 'node:path'

import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

describe('orders schema', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>
  beforeAll(async () => {
    ctx = await startCatalogApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const newOrder = async () => {
    const product = await ctx.prisma.product.findFirstOrThrow({include: {server: true}})
    return ctx.prisma.order.create({
      data: {
        publicId: `p${String(Date.now()).padStart(21, '0')}`,
        nick: 'Steve',
        email: 'steve@example.com',
        locale: 'en',
        currency: 'EUR',
        subtotalMinor: 499,
        discountMinor: 0,
        totalMinor: 499,
        deliveryConsentAt: new Date(),
        items: {
          create: {
            productId: product.id,
            serverId: product.serverId,
            quantity: 1,
            unitAmountMinor: 499,
            productName: 'VIP',
            serverName: product.server.name
          }
        }
      },
      include: {items: true}
    })
  }

  it('stores an order with its items, PENDING by default', async () => {
    const order = await newOrder()
    expect(order.status).toBe('PENDING')
    expect(order.items).toHaveLength(1)
  })

  it('refuses a duplicate webhook event id', async () => {
    await ctx.prisma.processedWebhookEvent.create({data: {stripeEventId: 'evt_1', type: 't'}})
    await expect(
      ctx.prisma.processedWebhookEvent.create({data: {stripeEventId: 'evt_1', type: 't'}})
    ).rejects.toMatchObject({code: 'P2002'})
  })

  it('refuses a quantity outside 1..99', async () => {
    const order = await newOrder()
    await expect(
      ctx.prisma.orderItem.update({where: {id: order.items[0]?.id ?? ''}, data: {quantity: 0}})
    ).rejects.toThrow()
  })

  it('gives existing ADMIN and SUPPORT roles order.read', async () => {
    // Simulate a database seeded before this change, then run the migration file itself.
    await ctx.prisma.role.updateMany({
      where: {name: {in: ['ADMIN', 'SUPPORT']}},
      data: {permissions: ['catalog.write']}
    })
    const sql = readFileSync(
      path.resolve(
        __dirname,
        '../prisma/migrations/20261017100100_order_read_permission/migration.sql'
      ),
      'utf8'
    )
    await ctx.prisma.$executeRawUnsafe(sql)
    await ctx.prisma.$executeRawUnsafe(sql) // idempotent
    const roles = await ctx.prisma.role.findMany({where: {name: {in: ['ADMIN', 'SUPPORT']}}})
    expect(roles).toHaveLength(2)
    for (const role of roles) {
      expect(role.permissions).toContain('order.read')
      expect(role.permissions).toContain('catalog.write')
      expect(role.permissions.filter(p => p === 'order.read')).toHaveLength(1)
    }
  })
})
