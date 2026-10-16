import request from 'supertest'

import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
beforeAll(async () => {
  ctx = await startOrdersApp()
  ctx.turnstile.verify = jest.fn().mockResolvedValue(true)
})
afterAll(async () => {
  await ctx.stop()
})

const body = (over: object = {}) => ({
  lines: [{server: 'survival', slug: 'vip', quantity: 2}],
  currency: 'EUR',
  locale: 'en',
  nick: 'Steve_1',
  email: 'steve@example.com',
  deliveryConsent: true,
  termsAccepted: true,
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  ...over
})
type Created = {publicId: string; redirectUrl: string}
const created = (res: {body: unknown}) => res.body as Created
const message = (res: {body: unknown}) => (res.body as {message: string}).message
const post = (b: object) => request(ctx.app.getHttpServer()).post('/api/orders').send(b)

describe('POST /api/orders', () => {
  it('creates a PENDING order priced from the database and returns the pay URL', async () => {
    const res = await post(body()).expect(201)
    expect(created(res).redirectUrl).toMatch(/^http:\/\/shop\.test\/api\/payments\/fake\/cs_fake_/)
    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: {publicId: created(res).publicId},
      include: {items: true}
    })
    const vip = await ctx.prisma.price.findFirstOrThrow({
      where: {currency: 'EUR', product: {slug: 'vip'}}
    })
    expect(order).toMatchObject({
      status: 'PENDING',
      totalMinor: vip.amountMinor * 2,
      subtotalMinor: vip.amountMinor * 2,
      discountMinor: 0,
      nick: 'Steve_1'
    })
    expect(order.stripeSessionId).toMatch(/^cs_fake_/)
    expect(order.items[0]).toMatchObject({
      quantity: 2,
      unitAmountMinor: vip.amountMinor,
      serverName: 'Survival'
    })
    const session = ctx.gateway.session(order.stripeSessionId ?? '')
    expect(session?.successUrl).toBe(`http://shop.test/order/${order.publicId}`)
    expect(session?.cancelUrl).toBe('http://shop.test/')
  })

  it('returns a pl order to the /pl prefixed pages', async () => {
    const res = await post(body({locale: 'pl'})).expect(201)
    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: {publicId: created(res).publicId}
    })
    const session = ctx.gateway.session(order.stripeSessionId ?? '')
    expect(session?.successUrl).toBe(`http://shop.test/pl/order/${order.publicId}`)
    expect(session?.cancelUrl).toBe('http://shop.test/pl')
  })

  it('ignores prices sent by the client (strict body)', async () => {
    await post(body({totalMinor: 1})).expect(400)
  })

  it('answers 409 with every unavailable line and creates nothing', async () => {
    const before = await ctx.prisma.order.count()
    await ctx.prisma.product.updateMany({where: {slug: 'legend'}, data: {isActive: false}})
    const res = await post(
      body({
        lines: [
          {server: 'survival', slug: 'vip', quantity: 1},
          {server: 'survival', slug: 'legend', quantity: 1},
          {server: 'survival', slug: 'nope', quantity: 1}
        ]
      })
    ).expect(409)
    expect(res.body).toMatchObject({
      message: 'unavailable',
      issues: {
        lines: [
          {server: 'survival', slug: 'legend'},
          {server: 'survival', slug: 'nope'}
        ]
      }
    })
    expect(await ctx.prisma.order.count()).toBe(before)
    await ctx.prisma.product.updateMany({where: {slug: 'legend'}, data: {isActive: true}})
  })

  it('answers 400 turnstile_failed when the token is refused', async () => {
    ctx.turnstile.verify = jest.fn().mockResolvedValue(false)
    const res = await post(body()).expect(400)
    expect(message(res)).toBe('turnstile_failed')
    ctx.turnstile.verify = jest.fn().mockResolvedValue(true)
  })

  it('answers 502 payments_unavailable and keeps no order when the gateway fails', async () => {
    const before = await ctx.prisma.order.count()
    const spy = jest
      .spyOn(ctx.gateway, 'createSession')
      .mockRejectedValueOnce(new Error('stripe down'))
    const res = await post(body()).expect(502)
    expect(message(res)).toBe('payments_unavailable')
    expect(await ctx.prisma.order.count()).toBe(before)
    spy.mockRestore()
  })
})

describe('GET /api/orders/:publicId', () => {
  it('returns the public view with a masked email and items grouped by server', async () => {
    const first = await post(body()).expect(201)
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/orders/${created(first).publicId}`)
      .expect(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toMatchObject({
      publicId: created(first).publicId,
      email: 's***@example.com',
      status: 'PENDING',
      paidAt: null,
      nick: 'Steve_1',
      currency: 'EUR'
    })
    expect((res.body as {servers: unknown[]}).servers[0]).toMatchObject({
      serverName: 'Survival',
      items: [{quantity: 2}]
    })
  })

  it('404s an unknown id', async () => {
    await request(ctx.app.getHttpServer()).get('/api/orders/AAAAAAAAAAAAAAAAAAAAAA').expect(404)
  })

  it('404s a malformed id without querying', async () => {
    const spy = jest.spyOn(ctx.prisma.order, 'findUnique')
    await request(ctx.app.getHttpServer()).get("/api/orders/x';").expect(404)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
