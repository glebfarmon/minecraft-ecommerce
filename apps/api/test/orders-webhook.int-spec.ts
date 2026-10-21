import request from 'supertest'

import {PrismaService} from '../src/prisma/prisma.service'
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

type Signed = {body: string; signature: string}
type EventType = 'checkout.session.completed' | 'checkout.session.expired'

async function createOrder(locale: 'en' | 'pl' = 'en', promoCode?: string) {
  const res = await request(ctx.app.getHttpServer())
    .post('/api/orders')
    .send({
      lines: [{server: 'survival', slug: 'vip', quantity: 2}],
      currency: 'EUR',
      locale,
      nick: 'Steve_1',
      email: 'steve@example.com',
      deliveryConsent: true,
      termsAccepted: true,
      ...(promoCode ? {promoCode} : {}),
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'
    })
    .expect(201)
  const {publicId} = res.body as {publicId: string}
  const order = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
  return {publicId, sessionId: order.stripeSessionId ?? ''}
}

const post = ({body, signature}: Signed) =>
  request(ctx.app.getHttpServer())
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(body)

const deliver = (sessionId: string, type: EventType) =>
  post(ctx.gateway.signedEvent(sessionId, type))

const statusOf = async (publicId: string) =>
  (await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})).status

const receipts = (publicId: string) => ctx.mailer.sent.filter(m => m.subject.includes(publicId))

describe('POST /api/webhooks/stripe', () => {
  it('marks the order PAID once and mails one receipt', async () => {
    const {publicId, sessionId} = await createOrder()
    const signed = ctx.gateway.signedEvent(sessionId, 'checkout.session.completed')
    await post(signed).expect(200)
    await post(signed).expect(200) // replay
    const order = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
    expect(order.status).toBe('PAID')
    expect(order.paidAt).not.toBeNull()
    expect(order.stripePaymentIntentId).toMatch(/^pi_fake_/)
    const mails = ctx.mailer.sent.filter(
      m => m.to === 'steve@example.com' && m.subject.includes(publicId)
    )
    expect(mails).toHaveLength(1)
    expect(mails[0]?.text).toContain(`http://shop.test/order/${publicId}`)
  })

  it('links a pl receipt to the /pl status page', async () => {
    const {publicId, sessionId} = await createOrder('pl')
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    const [mail] = receipts(publicId)
    expect(mail?.subject).toBe(`Zamówienie ${publicId} opłacone`)
    expect(mail?.text).toContain(`http://shop.test/pl/order/${publicId}`)
  })

  it('handles the same event delivered concurrently exactly once', async () => {
    const {publicId, sessionId} = await createOrder()
    const signed = ctx.gateway.signedEvent(sessionId, 'checkout.session.completed')
    const results = await Promise.all(Array.from({length: 5}, () => post(signed)))
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(await statusOf(publicId)).toBe('PAID')
    expect(receipts(publicId)).toHaveLength(1)
  })

  it('pays once when different paid events for one order arrive concurrently', async () => {
    const {publicId, sessionId} = await createOrder()
    const events = Array.from({length: 5}, () =>
      ctx.gateway.signedEvent(sessionId, 'checkout.session.completed')
    )
    const results = await Promise.all(events.map(post))
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(receipts(publicId)).toHaveLength(1)
  })

  it('two different paid events for one order pay it once', async () => {
    const {publicId, sessionId} = await createOrder()
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    const first = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    const second = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
    expect(second.paidAt).toEqual(first.paidAt)
    expect(receipts(publicId)).toHaveLength(1)
  })

  it('expires a PENDING order and ignores a later expiry for a PAID one', async () => {
    const pending = await createOrder()
    await deliver(pending.sessionId, 'checkout.session.expired').expect(200)
    expect(await statusOf(pending.publicId)).toBe('EXPIRED')
    expect(receipts(pending.publicId)).toHaveLength(0)

    const paid = await createOrder()
    await deliver(paid.sessionId, 'checkout.session.completed').expect(200)
    await deliver(paid.sessionId, 'checkout.session.expired').expect(200)
    expect(await statusOf(paid.publicId)).toBe('PAID')
    expect(receipts(paid.publicId)).toHaveLength(1)
  })

  it('pays an EXPIRED order when success arrives late', async () => {
    const {publicId, sessionId} = await createOrder()
    await deliver(sessionId, 'checkout.session.expired').expect(200)
    expect(await statusOf(publicId)).toBe('EXPIRED')
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    const order = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
    expect(order.status).toBe('PAID')
    expect(order.paidAt).not.toBeNull()
    expect(receipts(publicId)).toHaveLength(1)
  })

  it('leaves the order PENDING on an amount mismatch', async () => {
    const {publicId, sessionId} = await createOrder()
    await ctx.prisma.order.update({where: {publicId}, data: {totalMinor: 1}})
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    expect(await statusOf(publicId)).toBe('PENDING')
    expect(receipts(publicId)).toHaveLength(0)
  })

  it('leaves the order PENDING on a currency mismatch', async () => {
    const {publicId, sessionId} = await createOrder()
    await ctx.prisma.order.update({where: {publicId}, data: {currency: 'PLN'}})
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    expect(await statusOf(publicId)).toBe('PENDING')
  })

  it('answers 400 on a bad signature and changes nothing', async () => {
    const {publicId, sessionId} = await createOrder()
    const signed = ctx.gateway.signedEvent(sessionId, 'checkout.session.completed')
    const tampered = {...signed, body: signed.body.replace('"paid"', '"paid" ')}
    expect(tampered.body).not.toBe(signed.body)
    const res = await post(tampered).expect(400)
    expect(res.body).toMatchObject({statusCode: 400, message: 'invalid_signature'})
    const missing = await request(ctx.app.getHttpServer())
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(signed.body)
      .expect(400)
    expect(missing.body).toMatchObject({message: 'invalid_signature'})
    expect(await statusOf(publicId)).toBe('PENDING')
    const eventId = (JSON.parse(signed.body) as {id: string}).id
    expect(await ctx.prisma.processedWebhookEvent.count({where: {stripeEventId: eventId}})).toBe(0)
    expect(receipts(publicId)).toHaveLength(0)
  })

  it('answers 200 for an unknown session', async () => {
    const {publicId, sessionId} = await createOrder()
    const signed = ctx.gateway.signedEvent(sessionId, 'checkout.session.completed')
    await ctx.prisma.order.delete({where: {publicId}})
    await post(signed).expect(200)
    expect(receipts(publicId)).toHaveLength(0)
  })

  it('still pays when the receipt cannot be sent', async () => {
    const {publicId, sessionId} = await createOrder()
    const spy = jest.spyOn(ctx.mailer, 'send').mockRejectedValueOnce(new Error('smtp down'))
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
    expect(await statusOf(publicId)).toBe('PAID')
    expect(receipts(publicId)).toHaveLength(0)
  })
})

describe('promo uses and webhooks', () => {
  const makePromo = (code: string, maxUses: number) =>
    ctx.prisma.promoCode.create({data: {code, kind: 'PERCENT', value: 10, maxUses}})
  const used = async (id: string) =>
    (await ctx.prisma.promoCode.findUniqueOrThrow({where: {id}})).usedCount

  it('releases the use when the order expires, once', async () => {
    const promo = await makePromo('WHEXPIRE', 5)
    const {sessionId} = await createOrder('en', 'WHEXPIRE')
    expect(await used(promo.id)).toBe(1)
    await deliver(sessionId, 'checkout.session.expired').expect(200)
    expect(await used(promo.id)).toBe(0)
    await deliver(sessionId, 'checkout.session.expired').expect(200) // different event id
    expect(await used(promo.id)).toBe(0)
  })

  it('does not release on a replayed expiry event', async () => {
    const promo = await makePromo('WHREPLAY', 5)
    await ctx.prisma.promoCode.update({where: {id: promo.id}, data: {usedCount: 2}})
    const {sessionId} = await createOrder('en', 'WHREPLAY')
    const signed = ctx.gateway.signedEvent(sessionId, 'checkout.session.expired')
    await post(signed).expect(200)
    await post(signed).expect(200)
    expect(await used(promo.id)).toBe(2)
  })

  it('re-takes the use on a late payment even past maxUses', async () => {
    const promo = await makePromo('WHLATE', 1)
    const {publicId, sessionId} = await createOrder('en', 'WHLATE')
    await deliver(sessionId, 'checkout.session.expired').expect(200)
    expect(await used(promo.id)).toBe(0)
    await createOrder('en', 'WHLATE') // takes the only use meanwhile
    expect(await used(promo.id)).toBe(1)
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    expect(await statusOf(publicId)).toBe('PAID')
    expect(await used(promo.id)).toBe(2)
  })

  it('pays when the expiry commits just before the paid update runs', async () => {
    const promo = await makePromo('WHRACE', 5)
    const {publicId, sessionId} = await createOrder('en', 'WHRACE')
    const signed = ctx.gateway.signedEvent(sessionId, 'checkout.session.completed')
    const service = ctx.app.get(PrismaService)
    const original = service.$transaction.bind(service) as (...a: unknown[]) => unknown
    let flipped = false
    const spy = jest.spyOn(service, '$transaction').mockImplementation(((
      fn: (tx: Record<string, unknown>) => unknown,
      ...rest: unknown[]
    ) =>
      original(
        (tx: {order: {updateMany: (...a: unknown[]) => Promise<unknown>}}) =>
          fn(
            new Proxy(tx, {
              get(target, prop, recv) {
                const value = Reflect.get(target, prop, recv) as unknown
                if (prop !== 'order') return value
                return new Proxy(value as object, {
                  get(o, m, r) {
                    const f = Reflect.get(o, m, r) as (...a: unknown[]) => unknown
                    if (m !== 'updateMany') return f.bind(o)
                    return async (...args: unknown[]) => {
                      if (!flipped) {
                        flipped = true
                        // The expiry commits between the order lookup and the paid update.
                        await ctx.prisma.order.update({
                          where: {publicId},
                          data: {status: 'EXPIRED'}
                        })
                        await ctx.prisma.promoCode.update({
                          where: {id: promo.id},
                          data: {usedCount: {decrement: 1}}
                        })
                      }
                      return f.apply(o, args)
                    }
                  }
                })
              }
            })
          ),
        ...rest
      )) as never)
    await post(signed).expect(200)
    spy.mockRestore()
    expect(flipped).toBe(true)
    expect(await statusOf(publicId)).toBe('PAID')
    expect(await used(promo.id)).toBe(1)
    expect(receipts(publicId)).toHaveLength(1)
  })

  it('leaves usedCount unchanged on a normal payment', async () => {
    const promo = await makePromo('WHPAID', 5)
    const {sessionId} = await createOrder('en', 'WHPAID')
    await deliver(sessionId, 'checkout.session.completed').expect(200)
    expect(await used(promo.id)).toBe(1)
  })
})
