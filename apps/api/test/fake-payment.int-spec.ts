import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'
import request from 'supertest'

import {createApp} from '../src/create-app'
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

async function createOrder() {
  const res = await request(ctx.app.getHttpServer())
    .post('/api/orders')
    .send({
      lines: [{server: 'survival', slug: 'vip', quantity: 2}],
      currency: 'EUR',
      locale: 'en',
      nick: 'Steve_1',
      email: 'steve@example.com',
      deliveryConsent: true,
      termsAccepted: true,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'
    })
    .expect(201)
  const {publicId, redirectUrl} = res.body as {publicId: string; redirectUrl: string}
  return {publicId, path: new URL(redirectUrl).pathname}
}

describe('fake payment page', () => {
  it('renders the total and the Pay and Cancel buttons', async () => {
    const {publicId, path} = await createOrder()
    const res = await request(ctx.app.getHttpServer()).get(path).expect(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    const order = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
    const total = new Intl.NumberFormat('en', {style: 'currency', currency: 'EUR'}).format(
      order.totalMinor / 100
    )
    expect(res.text).toContain(total)
    expect(res.text).toMatch(/<button[^>]*>\s*Pay\s*<\/button>/)
    expect(res.text).toMatch(/<button[^>]*>\s*Cancel\s*<\/button>/)
  })

  it('pays the order through the webhook code path and redirects to the success URL', async () => {
    const {publicId, path} = await createOrder()
    const res = await request(ctx.app.getHttpServer()).post(`${path}/pay`).expect(303)
    expect(res.headers.location).toBe(`http://shop.test/order/${publicId}`)
    const order = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
    expect(order.status).toBe('PAID')
    expect(ctx.mailer.sent.some(m => m.to === 'steve@example.com')).toBe(true)
  })

  it('cancel redirects to the cancel URL and leaves the order PENDING', async () => {
    const {publicId, path} = await createOrder()
    const res = await request(ctx.app.getHttpServer()).post(`${path}/cancel`).expect(303)
    expect(res.headers.location).toBe('http://shop.test/')
    const order = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
    expect(order.status).toBe('PENDING')
  })

  it('answers 404 for an unknown session', async () => {
    const server = ctx.app.getHttpServer()
    await request(server).get('/api/payments/fake/cs_fake_nope').expect(404)
    await request(server).post('/api/payments/fake/cs_fake_nope/pay').expect(404)
    await request(server).post('/api/payments/fake/cs_fake_nope/cancel').expect(404)
  })

  it('answers 404 on all routes when the Stripe gateway is active', async () => {
    const saved = {...process.env}
    process.env.PAYMENTS_GATEWAY = 'stripe'
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
    let stripeApp: INestApplication<Server> | undefined
    try {
      stripeApp = await createApp()
      await stripeApp.init()
    } finally {
      for (const key of ['PAYMENTS_GATEWAY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'])
        if (saved[key] === undefined) Reflect.deleteProperty(process.env, key)
        else process.env[key] = saved[key]
    }
    try {
      const server = stripeApp.getHttpServer()
      await request(server).get('/api/payments/fake/anything').expect(404)
      await request(server).post('/api/payments/fake/anything/pay').expect(404)
      await request(server).post('/api/payments/fake/anything/cancel').expect(404)
    } finally {
      await stripeApp.close()
    }
  })
})
