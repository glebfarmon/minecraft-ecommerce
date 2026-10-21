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

const PARALLEL = 20

describe('promo code reservation under concurrency', () => {
  it('uses a maxUses 1 code exactly once across 20 parallel orders', async () => {
    const promo = await ctx.prisma.promoCode.create({
      data: {code: 'ONLYONCE', kind: 'PERCENT', value: 10, maxUses: 1}
    })
    const ordersBefore = await ctx.prisma.order.count()
    const results = await Promise.all(
      Array.from({length: PARALLEL}, (_, i) =>
        request(ctx.app.getHttpServer())
          .post('/api/orders')
          .send({
            lines: [{server: 'survival', slug: 'vip', quantity: 1}],
            currency: 'EUR',
            locale: 'en',
            nick: `Racer_${String(i)}`,
            email: `racer${String(i)}@example.com`,
            deliveryConsent: true,
            termsAccepted: true,
            turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
            promoCode: 'ONLYONCE'
          })
      )
    )
    const statuses = results.map(r => r.status)
    expect(statuses.filter(s => s === 201)).toHaveLength(1)
    const refused = results.filter(r => r.status === 409)
    expect(refused).toHaveLength(PARALLEL - 1)
    for (const r of refused)
      expect(r.body).toMatchObject({message: 'promo', issues: {reason: 'used_up'}})

    const row = await ctx.prisma.promoCode.findUniqueOrThrow({where: {id: promo.id}})
    expect(row.usedCount).toBe(1)
    expect(await ctx.prisma.order.count()).toBe(ordersBefore + 1)
    expect(await ctx.prisma.order.count({where: {promoCodeId: promo.id}})).toBe(1)
  })
})
