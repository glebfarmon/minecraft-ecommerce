import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

describe('delivery schema', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>
  beforeAll(async () => {
    ctx = await startCatalogApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  let seq = 0
  const newOrder = async () => {
    const product = await ctx.prisma.product.findFirstOrThrow({include: {server: true}})
    seq += 1
    const order = await ctx.prisma.order.create({
      data: {
        publicId: `d${String(Date.now()).padStart(20, '0')}${String(seq)}`,
        nick: 'Steve',
        email: 'steve@example.com',
        locale: 'en',
        currency: 'EUR',
        subtotalMinor: 499,
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
    const item = order.items[0]
    if (!item) throw new Error('order has no item')
    return {order, item, product}
  }

  const newGrant = async (nick: string) => {
    const product = await ctx.prisma.product.findFirstOrThrow()
    return ctx.prisma.grant.create({
      data: {nick, serverId: product.serverId, productId: product.id}
    })
  }

  it('rejects a second grant for the same nick, server and product', async () => {
    const grant = await newGrant('Alex')
    await expect(
      ctx.prisma.grant.create({
        data: {nick: 'Alex', serverId: grant.serverId, productId: grant.productId}
      })
    ).rejects.toMatchObject({code: 'P2002'})
  })

  it('rejects two GRANT deliveries for one order item', async () => {
    const {item} = await newOrder()
    const data = {orderItemId: item.id, serverId: item.serverId, kind: 'GRANT' as const}
    await ctx.prisma.delivery.create({data})
    await expect(ctx.prisma.delivery.create({data})).rejects.toMatchObject({code: 'P2002'})
  })

  it('allows a GRANT and a REVOKE delivery for one grant', async () => {
    const grant = await newGrant('Notch')
    const base = {grantId: grant.id, serverId: grant.serverId, commands: ['say hi']}
    await ctx.prisma.delivery.create({data: {...base, kind: 'GRANT'}})
    const revoke = await ctx.prisma.delivery.create({data: {...base, kind: 'REVOKE'}})
    expect(revoke.status).toBe('PENDING')
    expect(revoke.attempts).toBe(0)
    expect(revoke.commandsDone).toBe(0)
    expect(revoke.responseLog).toEqual([])
  })

  it('deleting an order cascades its deliveries', async () => {
    const {order, item} = await newOrder()
    const delivery = await ctx.prisma.delivery.create({
      data: {orderItemId: item.id, serverId: item.serverId, kind: 'GRANT'}
    })
    await ctx.prisma.order.delete({where: {id: order.id}})
    expect(await ctx.prisma.delivery.findUnique({where: {id: delivery.id}})).toBeNull()
  })

  it('gives the ADMIN role delivery.resolve', async () => {
    const rows = await ctx.prisma.$queryRaw<{permissions: string[]}[]>`
      SELECT "permissions" FROM "roles" WHERE "name" = 'ADMIN'`
    expect(rows[0]?.permissions).toContain('delivery.resolve')
  })
})
