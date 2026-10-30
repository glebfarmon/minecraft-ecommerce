import {createDeliveriesForPaidOrder} from '../src/delivery/delivery-creation'
import type {DeliveryStatus, Product} from '../src/generated/prisma/client'
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
const product = (kind: Product['kind']) =>
  ctx.prisma.product.findFirstOrThrow({where: {kind}, orderBy: {id: 'asc'}})

/** A PAID order with one item and its delivery, forced into `status`. */
async function stuck(status: DeliveryStatus, kind: Product['kind'] = 'PERMANENT') {
  seq += 1
  const p = await product(kind)
  const server = await ctx.prisma.server.findUniqueOrThrow({where: {id: p.serverId}})
  const order = await ctx.prisma.order.create({
    data: {
      publicId: `da${String(seq).padStart(19, '0')}`,
      nick: `Deliv${String(seq)}`,
      email: 'deliv@example.com',
      locale: 'en',
      currency: 'EUR',
      subtotalMinor: 499,
      totalMinor: 499,
      status: 'PAID',
      paidAt: new Date(),
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
  const ids = await ctx.prisma.$transaction(tx => createDeliveriesForPaidOrder(tx, order))
  const id = ids[0] ?? ''
  await ctx.prisma.delivery.update({
    where: {id},
    data: {
      status,
      attempts: 4,
      commandsDone: 1,
      lastError: 'boom',
      responseLog: ['first reply'],
      nextAttemptAt: new Date(Date.now() + 3_600_000)
    }
  })
  return {order, id, server}
}

const retry = (id: string) => `/api/admin/deliveries/${id}/retry`
const done = (id: string) => `/api/admin/deliveries/${id}/mark-done`
const resolver = () => ctx.admin({permissions: ['delivery.resolve']})

describe('admin delivery actions', () => {
  it('retry puts a FAILED delivery back to PENDING and keeps commandsDone', async () => {
    const {id} = await stuck('FAILED')
    const a = await resolver()
    const before = Date.now()
    const res = await a.post(retry(id)).expect(201)
    expect(res.body).toMatchObject({
      id,
      status: 'PENDING',
      attempts: 0,
      commandsDone: 1,
      lastError: 'boom',
      replies: ['first reply']
    })
    const row = await ctx.prisma.delivery.findUniqueOrThrow({where: {id}})
    expect(row.status).toBe('PENDING')
    expect(row.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now())
    expect(row.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before - 5_000)
  })

  it('retry of NEEDS_REVIEW is allowed', async () => {
    const {id} = await stuck('NEEDS_REVIEW')
    const a = await resolver()
    await a.post(retry(id)).expect(201)
    expect((await ctx.prisma.delivery.findUniqueOrThrow({where: {id}})).status).toBe('PENDING')
  })

  it('retry of DONE or RUNNING is 409 delivery_not_stuck', async () => {
    const a = await resolver()
    for (const status of ['DONE', 'RUNNING', 'PENDING'] as const) {
      const {id} = await stuck(status)
      const res = await a.post(retry(id)).expect(409)
      expect(res.body).toMatchObject({message: 'delivery_not_stuck'})
      await a.post(done(id)).expect(409)
      expect((await ctx.prisma.delivery.findUniqueOrThrow({where: {id}})).status).toBe(status)
    }
    await a.post(retry('nope')).expect(404)
    await a.post(done('nope')).expect(404)
  })

  it('mark-done completes the delivery, starts a TIMED clock and delivers the order', async () => {
    const {id, order} = await stuck('NEEDS_REVIEW', 'TIMED')
    const a = await resolver()
    const res = await a.post(done(id)).expect(201)
    expect(res.body).toMatchObject({id, status: 'DONE', lastError: null})
    const row = await ctx.prisma.delivery.findUniqueOrThrow({where: {id}})
    const grant = await ctx.prisma.grant.findUniqueOrThrow({where: {id: row.grantId ?? ''}})
    expect(grant.expiresAt).not.toBeNull()
    expect((await ctx.prisma.order.findUniqueOrThrow({where: {id: order.id}})).status).toBe(
      'DELIVERED'
    )
  })

  it('needs delivery.resolve (SUPPORT gets 403)', async () => {
    const {id} = await stuck('FAILED')
    const support = await ctx.admin('SUPPORT')
    await support.post(retry(id)).expect(403)
    await support.post(done(id)).expect(403)
    expect((await ctx.prisma.delivery.findUniqueOrThrow({where: {id}})).status).toBe('FAILED')
  })

  it('both actions write an audit entry', async () => {
    const a = await resolver()
    const one = await stuck('FAILED')
    const two = await stuck('NEEDS_REVIEW')
    await a.post(retry(one.id)).expect(201)
    await a.post(done(two.id)).expect(201)
    const rows = await waitForAuditRows(ctx.prisma, {entityId: {in: [one.id, two.id]}}, 2)
    const first = rows.find(r => r.entityId === one.id)
    const second = rows.find(r => r.entityId === two.id)
    expect(first).toMatchObject({action: 'delivery.retry', entityType: 'delivery'})
    expect(second).toMatchObject({action: 'delivery.mark_done', entityType: 'delivery'})
    expect(first?.before).toMatchObject({status: 'FAILED', attempts: 4})
    expect(first?.after).toMatchObject({status: 'PENDING'})
  })

  it('order detail lists deliveries with replies', async () => {
    const {id, order, server} = await stuck('FAILED')
    const support = await ctx.admin('SUPPORT')
    const res = await support.get(`/api/admin/orders/${order.id}`).expect(200)
    const body = res.body as {deliveries: Record<string, unknown>[]}
    expect(body.deliveries).toHaveLength(1)
    expect(body.deliveries[0]).toMatchObject({
      id,
      kind: 'GRANT',
      status: 'FAILED',
      serverName: server.name,
      productName: 'Name of product',
      commandsDone: 1,
      attempts: 4,
      lastError: 'boom',
      replies: ['first reply']
    })
  })

  it('list marks needsAttention and counts attentionCount', async () => {
    await ctx.prisma.delivery.updateMany({
      where: {status: {in: ['FAILED', 'NEEDS_REVIEW']}},
      data: {status: 'DONE'}
    })
    const bad = await stuck('FAILED')
    const bad2 = await stuck('NEEDS_REVIEW')
    const fine = await stuck('DONE')
    const support = await ctx.admin('SUPPORT')
    type Page = {
      orders: {id: string; needsAttention: boolean}[]
      attentionCount: number
    }
    const page = (await support.get('/api/admin/orders').expect(200)).body as Page
    const flag = (id: string) => page.orders.find(o => o.id === id)?.needsAttention
    expect(flag(bad.order.id)).toBe(true)
    expect(flag(bad2.order.id)).toBe(true)
    expect(flag(fine.order.id)).toBe(false)
    expect(page.attentionCount).toBe(2)
    const filtered = (
      await support.get('/api/admin/orders').query({q: 'nobody-matches'}).expect(200)
    ).body as Page
    expect(filtered.orders).toHaveLength(0)
    expect(filtered.attentionCount).toBe(2)
  })
})
