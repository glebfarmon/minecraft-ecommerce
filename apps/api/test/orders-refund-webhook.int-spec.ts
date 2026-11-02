import {Logger} from '@nestjs/common'
import request from 'supertest'

import {DELIVERY_QUEUE, type DeliveryQueue} from '../src/delivery/delivery-queue'
import {DeliveryService} from '../src/delivery/delivery.service'
import type {DeliveryKind} from '../src/generated/prisma/client'
import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

const OWNER = 'refund-owner@example.com'

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
beforeAll(async () => {
  ctx = await startOrdersApp()
  ctx.turnstile.verify = jest.fn().mockResolvedValue(true)
  // The demo catalog has no revoke commands; these two products take part in every order here.
  await ctx.prisma.product.updateMany({
    where: {slug: 'vip'},
    data: {revokeCommands: ['lp user {nick} parent remove vip']}
  })
  await ctx.prisma.product.updateMany({
    where: {slug: 'coins-1000'},
    data: {revokeCommands: ['eco take {nick} 1000']}
  })
  const owner = await ctx.prisma.role.findUniqueOrThrow({where: {name: 'OWNER'}})
  await ctx.prisma.user.create({
    data: {id: 'refund-owner', name: 'Owner', email: OWNER, roleId: owner.id}
  })
})
afterAll(async () => {
  await ctx.stop()
})

type Signed = {body: string; signature: string}
type ChargeKind = 'refunded' | 'dispute_opened' | 'dispute_won' | 'dispute_lost'
type Paid = {
  id: string
  publicId: string
  nick: string
  pi: string
  total: number
  currency: string
}

const queue = () => ctx.app.get<DeliveryQueue>(DELIVERY_QUEUE)

const post = ({body, signature}: Signed) =>
  request(ctx.app.getHttpServer())
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(body)

let seq = 0
async function createOrder() {
  seq += 1
  const nick = `Refund_${String(seq)}`
  const res = await request(ctx.app.getHttpServer())
    .post('/api/orders')
    .send({
      lines: [
        {server: 'survival', slug: 'vip', quantity: 1},
        {server: 'survival', slug: 'coins-1000', quantity: 1}
      ],
      currency: 'EUR',
      locale: 'en',
      nick,
      email: 'steve@example.com',
      deliveryConsent: true,
      termsAccepted: true,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'
    })
    .expect(201)
  const {publicId} = res.body as {publicId: string}
  const order = await ctx.prisma.order.findUniqueOrThrow({where: {publicId}})
  return {order, nick}
}

const complete = async (ids: string[]) => {
  const service = ctx.app.get(DeliveryService)
  for (const id of ids) await ctx.prisma.$transaction(tx => service.complete(tx, id))
}

const deliveries = (orderId: string, kind?: DeliveryKind) =>
  ctx.prisma.delivery.findMany({
    where: {orderItem: {orderId}, ...(kind ? {kind} : {})},
    orderBy: {id: 'asc'}
  })

/** A paid order of two items; `delivered` completes both GRANTs (order DELIVERED). */
async function paidOrder(delivered = true): Promise<Paid> {
  const {order, nick} = await createOrder()
  await post(
    ctx.gateway.signedEvent(order.stripeSessionId ?? '', 'checkout.session.completed')
  ).expect(200)
  if (delivered) await complete((await deliveries(order.id, 'GRANT')).map(d => d.id))
  const row = await ctx.prisma.order.findUniqueOrThrow({where: {id: order.id}})
  expect(row.status).toBe(delivered ? 'DELIVERED' : 'PAID')
  return {
    id: row.id,
    publicId: row.publicId,
    nick,
    pi: row.stripePaymentIntentId ?? '',
    total: row.totalMinor,
    currency: row.currency
  }
}

const signed = (kind: ChargeKind, o: Paid) =>
  ctx.gateway.signedChargeEvent(kind, o.pi, o.total, o.currency)
const charge = (kind: ChargeKind, o: Paid) => post(signed(kind, o))

const orderOf = (id: string) => ctx.prisma.order.findUniqueOrThrow({where: {id}})
const disputeMails = (publicId: string) =>
  ctx.mailer.sent.filter(m => m.to === OWNER && m.subject.includes(publicId))

describe('charge.refunded', () => {
  it.each([true, null])(
    'refundRevoke %p: REFUNDED, one REVOKE per delivered item, enqueued',
    async revoke => {
      const o = await paidOrder()
      if (revoke !== null)
        await ctx.prisma.order.update({
          where: {id: o.id},
          data: {refundRequestedAt: new Date(), refundRevoke: revoke}
        })
      const spy = jest.spyOn(queue(), 'enqueue')
      await charge('refunded', o).expect(200)
      const enqueued = spy.mock.calls.map(c => c[0])
      spy.mockRestore()
      const order = await orderOf(o.id)
      expect(order.status).toBe('REFUNDED')
      expect(order.refundedAt).not.toBeNull()
      const revokes = await deliveries(o.id, 'REVOKE')
      expect(revokes).toHaveLength(2)
      expect(new Set(revokes.map(r => r.orderItemId)).size).toBe(2)
      expect(revokes.flatMap(r => r.commands)).toEqual(
        expect.arrayContaining([`lp user ${o.nick} parent remove vip`, `eco take ${o.nick} 1000`])
      )
      expect(enqueued.sort()).toEqual(revokes.map(r => r.id).sort())
    }
  )

  it('refundRevoke false: REFUNDED, nothing revoked or cancelled', async () => {
    const o = await paidOrder(false)
    await ctx.prisma.order.update({
      where: {id: o.id},
      data: {refundRequestedAt: new Date(), refundRevoke: false}
    })
    await charge('refunded', o).expect(200)
    expect((await orderOf(o.id)).status).toBe('REFUNDED')
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(0)
    expect((await deliveries(o.id, 'GRANT')).map(d => d.status)).toEqual(['PENDING', 'PENDING'])
  })

  it('cancels the deliveries that sent nothing instead of revoking them', async () => {
    const o = await paidOrder(false)
    await charge('refunded', o).expect(200)
    expect((await orderOf(o.id)).status).toBe('REFUNDED')
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(0)
    expect((await deliveries(o.id, 'GRANT')).map(d => d.status)).toEqual(['CANCELLED', 'CANCELLED'])
  })

  it('a replayed event and a second refund event revoke once and change the order once', async () => {
    const o = await paidOrder()
    const event = signed('refunded', o)
    await post(event).expect(200)
    const first = await orderOf(o.id)
    await post(event).expect(200) // replay
    await charge('refunded', o).expect(200) // another event id for the same refund
    const after = await orderOf(o.id)
    expect(after.status).toBe('REFUNDED')
    expect(after.refundedAt).toEqual(first.refundedAt)
    expect(after.updatedAt).toEqual(first.updatedAt)
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(2)
  })

  it('concurrent duplicates revoke once', async () => {
    const o = await paidOrder()
    const event = signed('refunded', o)
    const others = Array.from({length: 3}, () => signed('refunded', o))
    const results = await Promise.all(
      [...Array.from({length: 4}, () => event), ...others].map(post)
    )
    expect(results.map(r => r.status)).toEqual(Array.from({length: 7}, () => 200))
    expect((await orderOf(o.id)).status).toBe('REFUNDED')
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(2)
  })

  it('still refunds when the queue is down', async () => {
    const o = await paidOrder()
    const spy = jest.spyOn(queue(), 'enqueue').mockRejectedValue(new Error('redis down'))
    await charge('refunded', o).expect(200)
    spy.mockRestore()
    expect((await orderOf(o.id)).status).toBe('REFUNDED')
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(2)
  })
})

describe('ignored charge events', () => {
  it('answers 200 for an unknown payment intent', async () => {
    const o = await paidOrder()
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    try {
      await charge('refunded', {...o, pi: 'pi_unknown_refund'}).expect(200)
      await charge('dispute_opened', {...o, pi: 'pi_unknown_refund'}).expect(200)
      const unmatched = log.mock.calls.filter(([m]) =>
        String(m).includes('no order for payment pi_unknown_refund')
      )
      expect(unmatched).toHaveLength(2)
    } finally {
      log.mockRestore()
    }
    expect((await orderOf(o.id)).status).toBe('DELIVERED')
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(0)
  })

  it('ignores a payment intent shared by two orders', async () => {
    const a = await paidOrder()
    const b = await paidOrder()
    await ctx.prisma.order.update({where: {id: b.id}, data: {stripePaymentIntentId: a.pi}})
    await charge('refunded', a).expect(200)
    expect((await orderOf(a.id)).status).toBe('DELIVERED')
    expect((await orderOf(b.id)).status).toBe('DELIVERED')
    expect(await deliveries(a.id, 'REVOKE')).toHaveLength(0)
  })

  it('ignores a refund of an EXPIRED order', async () => {
    const {order} = await createOrder()
    await post(
      ctx.gateway.signedEvent(order.stripeSessionId ?? '', 'checkout.session.expired')
    ).expect(200)
    await ctx.prisma.order.update({where: {id: order.id}, data: {stripePaymentIntentId: 'pi_exp'}})
    await post(ctx.gateway.signedChargeEvent('refunded', 'pi_exp', order.totalMinor, 'EUR')).expect(
      200
    )
    const row = await orderOf(order.id)
    expect(row.status).toBe('EXPIRED')
    expect(row.refundedAt).toBeNull()
  })

  it('ignores a dispute opened on a REFUNDED order: no mail, no new REVOKE', async () => {
    const o = await paidOrder()
    await charge('refunded', o).expect(200)
    await charge('dispute_opened', o).expect(200)
    expect((await orderOf(o.id)).status).toBe('REFUNDED')
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(2)
    expect(disputeMails(o.publicId)).toHaveLength(0)
  })

  it('ignores a won dispute on a REFUNDED order', async () => {
    const o = await paidOrder()
    await charge('refunded', o).expect(200)
    await complete((await deliveries(o.id, 'REVOKE')).map(d => d.id))
    await charge('dispute_won', o).expect(200)
    expect((await orderOf(o.id)).status).toBe('REFUNDED')
    expect(await deliveries(o.id, 'RESTORE')).toHaveLength(0)
  })

  it('a second dispute event on a DISPUTED order mails and revokes nothing more', async () => {
    const o = await paidOrder()
    await charge('dispute_opened', o).expect(200)
    await charge('dispute_opened', o).expect(200)
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(2)
    expect(disputeMails(o.publicId)).toHaveLength(1)
  })
})

describe('disputes', () => {
  it('opened: DISPUTED, REVOKEs enqueued, the owners mailed in English', async () => {
    const o = await paidOrder()
    const spy = jest.spyOn(queue(), 'enqueue')
    const event = signed('dispute_opened', o)
    const disputeId = (JSON.parse(event.body) as {data: {object: {id: string}}}).data.object.id
    await post(event).expect(200)
    const enqueued = spy.mock.calls.map(c => c[0])
    spy.mockRestore()
    expect((await orderOf(o.id)).status).toBe('DISPUTED')
    const revokes = await deliveries(o.id, 'REVOKE')
    expect(revokes).toHaveLength(2)
    expect(enqueued.sort()).toEqual(revokes.map(r => r.id).sort())
    const mails = disputeMails(o.publicId)
    expect(mails).toHaveLength(1)
    const text = mails[0]?.text ?? ''
    expect(mails[0]?.subject).toMatch(/dispute/i)
    expect(text).toContain(o.nick)
    expect(text).toContain('€')
    expect(text).toContain(`/orders/${o.id}`)
    expect(text).toContain(`https://dashboard.stripe.com/disputes/${disputeId}`)
  })

  it('opened concurrently: one REVOKE set, one mail', async () => {
    const o = await paidOrder()
    const event = signed('dispute_opened', o)
    const results = await Promise.all(Array.from({length: 5}, () => post(event)))
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(2)
    expect(disputeMails(o.publicId)).toHaveLength(1)
  })

  it('still disputes when the mail cannot be sent', async () => {
    const o = await paidOrder()
    const spy = jest.spyOn(ctx.mailer, 'send').mockRejectedValueOnce(new Error('smtp down'))
    await charge('dispute_opened', o).expect(200)
    spy.mockRestore()
    expect((await orderOf(o.id)).status).toBe('DISPUTED')
    expect(await deliveries(o.id, 'REVOKE')).toHaveLength(2)
  })

  it('won: PAID with one RESTORE per revoked item, DELIVERED once they complete', async () => {
    const o = await paidOrder()
    await charge('dispute_opened', o).expect(200)
    const revokes = await deliveries(o.id, 'REVOKE')
    await complete(revokes.map(d => d.id))
    const spy = jest.spyOn(queue(), 'enqueue')
    const won = signed('dispute_won', o)
    await post(won).expect(200)
    await post(won).expect(200) // replay
    await charge('dispute_won', o).expect(200) // another event id
    const enqueued = spy.mock.calls.map(c => c[0])
    spy.mockRestore()
    expect((await orderOf(o.id)).status).toBe('PAID')
    const restores = await deliveries(o.id, 'RESTORE')
    expect(restores).toHaveLength(2)
    expect(new Set(restores.map(r => r.orderItemId)).size).toBe(2)
    expect(enqueued.sort()).toEqual(restores.map(r => r.id).sort())
    await complete(restores.map(d => d.id))
    expect((await orderOf(o.id)).status).toBe('DELIVERED')
  })

  it('won before the REVOKEs ran: they are cancelled and the order is DELIVERED again', async () => {
    const o = await paidOrder()
    await charge('dispute_opened', o).expect(200)
    await charge('dispute_won', o).expect(200)
    expect((await orderOf(o.id)).status).toBe('DELIVERED')
    expect(await deliveries(o.id, 'RESTORE')).toHaveLength(0)
    expect((await deliveries(o.id, 'REVOKE')).map(d => d.status)).toEqual([
      'CANCELLED',
      'CANCELLED'
    ])
  })

  it('lost: stays DISPUTED, no RESTORE, no second mail', async () => {
    const o = await paidOrder()
    await charge('dispute_opened', o).expect(200)
    await complete((await deliveries(o.id, 'REVOKE')).map(d => d.id))
    await charge('dispute_lost', o).expect(200)
    expect((await orderOf(o.id)).status).toBe('DISPUTED')
    expect(await deliveries(o.id, 'RESTORE')).toHaveLength(0)
    expect(disputeMails(o.publicId)).toHaveLength(1)
  })
})
