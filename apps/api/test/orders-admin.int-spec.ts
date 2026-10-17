import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
let n = 0
const publicIds: Record<string, string> = {}

type Item = {id: string; publicId: string; nick: string; email: string; status: string}
type Page = {orders: Item[]; nextCursor: string | null}

const make = (nick: string, email: string, status: 'PENDING' | 'PAID' = 'PENDING') => {
  n += 1
  const publicId = `ord${String(n).padStart(19, '0')}`
  return ctx.prisma.order.create({
    data: {
      publicId,
      nick,
      email,
      locale: 'en',
      currency: 'EUR',
      subtotalMinor: 500,
      totalMinor: 500,
      status,
      stripeSessionId: `cs_fake_admin_${String(n)}`,
      deliveryConsentAt: new Date(),
      paidAt: status === 'PAID' ? new Date() : null,
      // distinct, increasing timestamps so the order is deterministic
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n))
    }
  })
}

beforeAll(async () => {
  ctx = await startOrdersApp()
  for (const nick of ['Alex', 'Alex', 'Alex']) await make(nick, `${nick.toLowerCase()}@example.com`)
  await make('alexander', 'alexander@example.com')
  const bob = await make('Bob', 'bob@example.com', 'PAID')
  publicIds.bob = bob.publicId
  for (let i = 0; i < 55; i++) await make(`Filler${String(i)}`, `f${String(i)}@example.com`)
})
afterAll(async () => {
  await ctx.stop()
})

describe('admin orders', () => {
  it('lets SUPPORT read and forbids a role without order.read', async () => {
    const support = await ctx.admin('SUPPORT')
    await support.get('/api/admin/orders').expect(200)
    const custom = await ctx.admin({permissions: ['audit.read']})
    await custom.get('/api/admin/orders').expect(403)
    await custom.get('/api/admin/orders/whatever').expect(403)
  })

  it('pages newest first, 50 at a time, with no repeats', async () => {
    const admin = await ctx.admin('SUPPORT')
    const first = (await admin.get('/api/admin/orders').expect(200)).body as Page
    expect(first.orders).toHaveLength(50)
    expect(first.nextCursor).toBe(first.orders[49]?.id)
    expect(first.orders[0]?.nick).toBe('Filler54')
    const second = (
      await admin.get(`/api/admin/orders?cursor=${first.nextCursor ?? ''}`).expect(200)
    ).body as Page
    expect(second.orders).toHaveLength(10)
    expect(second.nextCursor).toBeNull()
    const ids = [...first.orders, ...second.orders].map(o => o.id)
    expect(new Set(ids).size).toBe(60)
  })

  it('searches by nick prefix, exact email and public id', async () => {
    const admin = await ctx.admin('SUPPORT')
    const nicks = async (q: string) =>
      ((await admin.get('/api/admin/orders').query({q}).expect(200)).body as Page).orders
    expect((await nicks('alex')).map(o => o.nick).sort()).toEqual([
      'Alex',
      'Alex',
      'Alex',
      'alexander'
    ])
    expect((await nicks('BOB@EXAMPLE.COM')).map(o => o.nick)).toEqual(['Bob'])
    expect((await nicks(publicIds.bob ?? '')).map(o => o.nick)).toEqual(['Bob'])
  })

  it('filters by status and rejects an unknown one', async () => {
    const admin = await ctx.admin('SUPPORT')
    const paid = (await admin.get('/api/admin/orders?status=PAID').expect(200)).body as Page
    expect(paid.orders.map(o => o.nick)).toEqual(['Bob'])
    await admin.get('/api/admin/orders?status=NOPE').expect(400)
  })

  it('shows one order with the full email, session id and consent time', async () => {
    const admin = await ctx.admin('SUPPORT')
    const row = await ctx.prisma.order.findFirstOrThrow({where: {nick: 'Bob'}})
    const res = await admin.get(`/api/admin/orders/${row.id}`).expect(200)
    expect(res.body).toMatchObject({
      id: row.id,
      email: 'bob@example.com',
      stripeSessionId: row.stripeSessionId,
      deliveryConsentAt: row.deliveryConsentAt.toISOString(),
      status: 'PAID'
    })
    await admin.get('/api/admin/orders/nope').expect(404)
  })

  it('groups items by server in item id order, as the public view does', async () => {
    const admin = await ctx.admin('SUPPORT')
    const product = await ctx.prisma.product.findFirstOrThrow({include: {server: true}})
    const order = await make('Grouped', 'grouped@example.com')
    const item = (id: string, serverName: string) => ({
      id,
      orderId: order.id,
      productId: product.id,
      serverId: product.serverId,
      quantity: 1,
      unitAmountMinor: 100,
      productName: `Item ${id}`,
      serverName
    })
    // inserted in the opposite order to their ids, so only an explicit ORDER BY id passes
    await ctx.prisma.orderItem.create({data: item('item-b', 'Beta')})
    await ctx.prisma.orderItem.create({data: item('item-a', 'Alpha')})
    const res = await admin.get(`/api/admin/orders/${order.id}`).expect(200)
    const body = res.body as {servers: {serverName: string}[]}
    expect(body.servers.map(s => s.serverName)).toEqual(['Alpha', 'Beta'])
  })
})
