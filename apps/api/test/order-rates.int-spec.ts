import request from 'supertest'

import {OrderRatesService} from '../src/orders/order-rates.service'
import {EXCHANGE_RATES, type ExchangeRates} from '../src/rates/exchange-rates'
import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
let rates: {eurPlnBefore: jest.Mock}
let service: OrderRatesService
beforeAll(async () => {
  ctx = await startOrdersApp()
  ctx.turnstile.verify = jest.fn().mockResolvedValue(true)
  rates = ctx.app.get<ExchangeRates>(EXCHANGE_RATES) as unknown as typeof rates
  rates.eurPlnBefore = jest.fn().mockResolvedValue({rate: '4.3000', date: '2026-10-16'})
  service = ctx.app.get(OrderRatesService)
})
afterAll(async () => {
  await ctx.stop()
})

async function createOrder(currency: 'EUR' | 'PLN' = 'EUR') {
  const res = await request(ctx.app.getHttpServer())
    .post('/api/orders')
    .send({
      lines: [{server: 'survival', slug: 'vip', quantity: 2}],
      currency,
      locale: 'en',
      nick: 'Steve_1',
      email: 'steve@example.com',
      deliveryConsent: true,
      termsAccepted: true,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'
    })
    .expect(201)
  const {publicId} = res.body as {publicId: string}
  const order = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
  return {publicId, id: order.id, sessionId: order.stripeSessionId ?? ''}
}

const pay = (sessionId: string) => {
  const {body, signature} = ctx.gateway.signedEvent(sessionId, 'checkout.session.completed')
  return request(ctx.app.getHttpServer())
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(body)
}

const read = (id: string) => ctx.prisma.order.findUniqueOrThrow({where: {id}})

async function waitForRate(id: string) {
  for (let i = 0; i < 100; i++) {
    const order = await read(id)
    if (order.eurPlnRate) return order
    await new Promise(r => setTimeout(r, 50))
  }
  throw new Error('rate never filled')
}

/** An order that was paid without the webhook path, at an exact instant. */
async function paidAt(at: string, currency: 'EUR' | 'PLN' = 'EUR') {
  const {id} = await createOrder(currency)
  await ctx.prisma.order.update({where: {id}, data: {status: 'PAID', paidAt: new Date(at)}})
  return id
}

describe('order exchange rates', () => {
  beforeEach(() => {
    rates.eurPlnBefore.mockReset().mockResolvedValue({rate: '4.3000', date: '2026-10-16'})
  })

  it('fixes the rate and both totals when an order is paid', async () => {
    const {id, sessionId} = await createOrder()
    await pay(sessionId).expect(200)
    const order = await waitForRate(id)
    expect(order.eurPlnRate?.toFixed(4)).toBe('4.3000')
    expect(order.rateDate?.toISOString().slice(0, 10)).toBe('2026-10-16')
    expect(order.totalEurMinor).toBe(order.totalMinor)
    expect(order.totalPlnMinor).toBe(Math.round(order.totalMinor * 4.3))
  })

  it('a rates outage leaves the order unfilled, the webhook 2xx and the receipt sent; the sweep fills it later', async () => {
    rates.eurPlnBefore.mockRejectedValue(new Error('NBP down'))
    const {id, publicId, sessionId} = await createOrder()
    await pay(sessionId).expect(200)
    await service.fill(id) // let the fire-and-forget attempt settle, same outcome
    const order = await read(id)
    expect(order.status).toBe('PAID')
    expect(order.eurPlnRate).toBeNull()
    expect(order.totalPlnMinor).toBeNull()
    expect(ctx.mailer.sent.filter(m => m.subject.includes(publicId))).toHaveLength(1)

    rates.eurPlnBefore.mockResolvedValue({rate: '4.3000', date: '2026-10-16'})
    await service.sweep()
    expect((await read(id)).eurPlnRate?.toFixed(4)).toBe('4.3000')
  })

  it('stays pending when NBP has no table', async () => {
    rates.eurPlnBefore.mockResolvedValue(null)
    const id = await paidAt('2026-10-17T10:00:00Z')
    await expect(service.fill(id)).resolves.toBe('pending')
    expect((await read(id)).eurPlnRate).toBeNull()
  })

  it('two concurrent fills write once', async () => {
    const id = await paidAt('2026-10-17T10:00:00Z')
    const results = await Promise.all([service.fill(id), service.fill(id)])
    expect(results.slice().sort()).toEqual(['filled', 'skipped'])
    expect((await read(id)).totalPlnMinor).not.toBeNull()
  })

  it('never recomputes a filled order', async () => {
    const id = await paidAt('2026-10-17T10:00:00Z')
    await service.fill(id)
    rates.eurPlnBefore.mockResolvedValue({rate: '9.9999', date: '2026-10-16'})
    await expect(service.fill(id)).resolves.toBe('skipped')
    expect((await read(id)).eurPlnRate?.toFixed(4)).toBe('4.3000')
  })

  it('skips an unpaid order', async () => {
    const {id} = await createOrder()
    await expect(service.fill(id)).resolves.toBe('skipped')
    expect(rates.eurPlnBefore).not.toHaveBeenCalled()
  })

  it('asks for the Warsaw day: paid 00:30 on Monday Warsaw time is Monday, not Sunday UTC', async () => {
    const id = await paidAt('2026-10-18T22:30:00Z') // Mon 2026-10-19 00:30 CEST
    await service.fill(id)
    expect(rates.eurPlnBefore).toHaveBeenCalledWith('2026-10-19')
  })

  it('converts a PLN order to EUR', async () => {
    const id = await paidAt('2026-10-17T10:00:00Z', 'PLN')
    await service.fill(id)
    const order = await read(id)
    expect(order.totalPlnMinor).toBe(order.totalMinor)
    expect(order.totalEurMinor).toBe(Math.round(order.totalMinor / 4.3))
  })

  it('sweep fills only paid orders still missing a rate, newest first, across batches', async () => {
    const old = await paidAt('2026-10-10T10:00:00Z')
    const mid = await paidAt('2026-10-11T10:00:00Z')
    const recent = await paidAt('2026-10-12T10:00:00Z')
    const {id: pending} = await createOrder()
    const days: string[] = []
    rates.eurPlnBefore.mockImplementation((day: string) => {
      days.push(day)
      return Promise.resolve({rate: '4.3000', date: '2026-10-09'})
    })
    await service.sweep(1) // one order per batch: it must keep going until none are left
    for (const id of [old, mid, recent]) expect((await read(id)).eurPlnRate).not.toBeNull()
    expect((await read(pending)).eurPlnRate).toBeNull()
    // Earlier tests leave unfillable orders behind; only this test's days matter.
    expect(days.filter(d => d <= '2026-10-12')).toEqual(['2026-10-12', '2026-10-11', '2026-10-10'])
  })

  it('sweep asks the rates source once per day and survives orders it cannot fill', async () => {
    const a = await paidAt('2026-10-13T08:00:00Z')
    const b = await paidAt('2026-10-13T09:00:00Z')
    const down = await paidAt('2026-10-14T09:00:00Z')
    const days: string[] = []
    rates.eurPlnBefore.mockImplementation((day: string) => {
      days.push(day)
      return day === '2026-10-14'
        ? Promise.reject(new Error('NBP down'))
        : Promise.resolve({rate: '4.3000', date: '2026-10-12'})
    })
    await service.sweep(1)
    expect(days.filter(d => d === '2026-10-13')).toHaveLength(1)
    expect((await read(a)).eurPlnRate).not.toBeNull()
    expect((await read(b)).eurPlnRate).not.toBeNull()
    expect((await read(down)).eurPlnRate).toBeNull()
  })
})
