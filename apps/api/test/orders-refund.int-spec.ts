import {createDeliveriesForPaidOrder} from '../src/delivery/delivery-creation'
import type {DeliveryStatus, OrderStatus} from '../src/generated/prisma/client'
import {waitForAuditRows} from './support/audit'
import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
beforeAll(async () => {
  ctx = await startOrdersApp()
})
afterAll(async () => {
  await ctx.stop()
})

let seq = 0

/** An order with one PERMANENT item and its GRANT delivery in `delivery`. */
async function order(
  opts: {
    status?: OrderStatus
    delivery?: DeliveryStatus
    commandsDone?: number
    pi?: string | null
  } = {}
) {
  seq += 1
  const p = await ctx.prisma.product.findFirstOrThrow({
    where: {kind: 'PERMANENT'},
    orderBy: {id: 'asc'}
  })
  const server = await ctx.prisma.server.findUniqueOrThrow({where: {id: p.serverId}})
  const created = await ctx.prisma.order.create({
    data: {
      publicId: `rf${String(seq).padStart(19, '0')}`,
      nick: `Refund${String(seq)}`,
      email: 'refund@example.com',
      locale: 'en',
      currency: 'EUR',
      subtotalMinor: 499,
      totalMinor: 499,
      status: opts.status ?? 'PAID',
      paidAt: new Date(),
      stripePaymentIntentId: opts.pi === undefined ? `pi_refund_${String(seq)}` : opts.pi,
      deliveryConsentAt: new Date(),
      items: {
        create: [
          {
            productId: p.id,
            serverId: p.serverId,
            quantity: 1,
            unitAmountMinor: 499,
            productName: 'Name of product',
            serverName: server.name
          }
        ]
      }
    },
    include: {items: {orderBy: {id: 'asc'}}}
  })
  const ids = await ctx.prisma.$transaction(tx => createDeliveriesForPaidOrder(tx, created))
  const deliveryId = ids[0] ?? ''
  if (opts.delivery && opts.delivery !== 'PENDING')
    await ctx.prisma.delivery.update({
      where: {id: deliveryId},
      data: {status: opts.delivery, commandsDone: opts.commandsDone ?? 0}
    })
  return {...created, deliveryId}
}

const url = (id: string) => `/api/admin/orders/${id}/refund`
const owner = () => ctx.admin('OWNER')
const row = (id: string) => ctx.prisma.order.findUniqueOrThrow({where: {id}})
const delivery = (id: string) => ctx.prisma.delivery.findUniqueOrThrow({where: {id}})
const callsFor = (pi: string) => ctx.gateway.refundCalls.filter(c => c.paymentIntentId === pi)

describe('admin refund', () => {
  it('reserves, calls the gateway once with the key and cancels unsent deliveries (revoke)', async () => {
    const o = await order()
    const a = await owner()
    const res = await a.post(url(o.id)).send({revoke: true}).expect(201)
    expect(res.body).toMatchObject({id: o.id, status: 'PAID'})
    expect((res.body as {refundRequestedAt: string | null}).refundRequestedAt).not.toBeNull()
    expect(callsFor(o.stripePaymentIntentId ?? '')).toEqual([
      expect.objectContaining({idempotencyKey: `refund-${o.id}`})
    ])
    const after = await row(o.id)
    expect(after.refundRequestedAt).not.toBeNull()
    expect(after.refundRevoke).toBe(true)
    expect(after.status).toBe('PAID')
    expect((await delivery(o.deliveryId)).status).toBe('CANCELLED')
  })

  it('revoke false cancels nothing', async () => {
    const o = await order()
    const a = await owner()
    await a.post(url(o.id)).send({revoke: false}).expect(201)
    expect((await row(o.id)).refundRevoke).toBe(false)
    expect((await delivery(o.deliveryId)).status).toBe('PENDING')
  })

  it('refuses while a delivery is RUNNING or NEEDS_REVIEW and reserves nothing', async () => {
    const a = await owner()
    for (const status of ['RUNNING', 'NEEDS_REVIEW'] as const) {
      const o = await order({delivery: status})
      const res = await a.post(url(o.id)).send({revoke: true}).expect(409)
      expect(res.body).toMatchObject({message: 'refund_delivery_open'})
      expect((await row(o.id)).refundRequestedAt).toBeNull()
      expect(callsFor(o.stripePaymentIntentId ?? '')).toHaveLength(0)
    }
  })

  it('two parallel requests make one gateway call', async () => {
    const o = await order()
    const a = await owner()
    const results = await Promise.all([
      a.post(url(o.id)).send({revoke: false}),
      a.post(url(o.id)).send({revoke: false})
    ])
    expect(results.map(r => r.status).sort()).toEqual([201, 409])
    expect(results.find(r => r.status === 409)?.body).toMatchObject({
      message: 'refund_already_requested'
    })
    expect(callsFor(o.stripePaymentIntentId ?? '')).toHaveLength(1)
  })

  it('a second request is refused, but allowed after 15 minutes with the same key', async () => {
    const o = await order()
    const a = await owner()
    await a.post(url(o.id)).send({revoke: false}).expect(201)
    await a.post(url(o.id)).send({revoke: false}).expect(409)
    await ctx.prisma.order.update({
      where: {id: o.id},
      data: {refundRequestedAt: new Date(Date.now() - 16 * 60_000)}
    })
    await a.post(url(o.id)).send({revoke: false}).expect(201)
    const calls = callsFor(o.stripePaymentIntentId ?? '')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.idempotencyKey).toBe(`refund-${o.id}`)
    expect(calls[1]?.refundId).toBe(calls[0]?.refundId)
  })

  it('clears the reservation and cancels nothing when the gateway throws (async and sync)', async () => {
    const a = await owner()
    for (const mode of ['async', 'sync'] as const) {
      const o = await order()
      const spy = jest.spyOn(ctx.gateway, 'refund').mockImplementationOnce(() => {
        if (mode === 'sync') throw new Error('key reuse')
        return Promise.reject(new Error('stripe down'))
      })
      const res = await a.post(url(o.id)).send({revoke: true}).expect(502)
      expect(res.body).toMatchObject({message: 'refund_failed'})
      spy.mockRestore()
      const after = await row(o.id)
      expect(after.refundRequestedAt).toBeNull()
      expect(after.refundRevoke).toBeNull()
      expect((await delivery(o.deliveryId)).status).toBe('PENDING')
      // A retry now works.
      await a.post(url(o.id)).send({revoke: true}).expect(201)
    }
  })

  it('refuses PENDING, EXPIRED, REFUNDED orders and orders without a payment intent', async () => {
    const a = await owner()
    const cases = [
      await order({status: 'PENDING'}),
      await order({status: 'EXPIRED'}),
      await order({status: 'REFUNDED'}),
      await order({pi: null})
    ]
    for (const o of cases) {
      const res = await a.post(url(o.id)).send({revoke: true}).expect(409)
      expect(res.body).toMatchObject({message: 'refund_not_allowed'})
      expect((await row(o.id)).refundRequestedAt).toBeNull()
    }
    await a.post(url('nope')).send({revoke: true}).expect(404)
  })

  it('validates the body', async () => {
    const o = await order()
    const a = await owner()
    await a.post(url(o.id)).send({}).expect(400)
  })

  it('needs order.refund (403) and writes an audit row on success', async () => {
    const o = await order()
    const admin = await ctx.admin('ADMIN')
    await admin.post(url(o.id)).send({revoke: true}).expect(403)
    expect((await row(o.id)).refundRequestedAt).toBeNull()
    const a = await owner()
    await a.post(url(o.id)).send({revoke: false}).expect(201)
    const [audit] = await waitForAuditRows(ctx.prisma, {entityId: o.id}, 1)
    expect(audit).toMatchObject({action: 'order.refund', entityType: 'order'})
    expect(audit?.before).toMatchObject({id: o.id, status: 'PAID'})
  })
})
