import request from 'supertest'

import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
beforeAll(async () => {
  ctx = await startOrdersApp()
})
afterAll(async () => {
  await ctx.stop()
})

const vip2 = [{server: 'survival', slug: 'vip', quantity: 2}] // EUR 998 (unit 499)
const validate = (code: string, over: object = {}) =>
  request(ctx.app.getHttpServer())
    .post('/api/promo/validate')
    .send({code, currency: 'EUR', lines: vip2, ...over})
const percent = {kind: 'PERCENT', value: 10} as const
const day = 86_400_000

describe('POST /api/promo/validate', () => {
  it('prices a valid code from the database', async () => {
    await ctx.prisma.promoCode.create({data: {code: 'TEN', ...percent}})
    const res = await validate('TEN').expect(200)
    expect(res.body).toEqual({
      ok: true,
      code: 'TEN',
      subtotalMinor: 998,
      discountMinor: 99,
      totalMinor: 899
    })
  })

  it('caps the discount so the total stays at the Stripe minimum', async () => {
    await ctx.prisma.promoCode.create({
      data: {code: 'BIGFIX', kind: 'FIXED', value: 100_000, currency: 'EUR'}
    })
    const res = await validate('BIGFIX', {
      lines: [{server: 'survival', slug: 'vip', quantity: 1}]
    }).expect(200)
    expect(res.body).toMatchObject({ok: true, discountMinor: 449, totalMinor: 50})
  })

  it('does not change usedCount', async () => {
    await validate('TEN').expect(200)
    const row = await ctx.prisma.promoCode.findFirstOrThrow({where: {code: 'TEN'}})
    expect(row.usedCount).toBe(0)
  })

  it.each([
    ['not_started', {code: 'FUTURE', ...percent, startsAt: new Date(Date.now() + day)}, 'FUTURE'],
    ['expired', {code: 'PAST', ...percent, endsAt: new Date(Date.now() - day)}, 'PAST'],
    ['used_up', {code: 'SPENT', ...percent, maxUses: 1, usedCount: 1}, 'SPENT'],
    ['wrong_currency', {code: 'PLNONLY', kind: 'FIXED', value: 500, currency: 'PLN'}, 'PLNONLY'],
    ['not_found', {code: 'OFF', ...percent, isActive: false}, 'OFF'],
    ['not_found', {code: 'GONE', ...percent, deletedAt: new Date()}, 'GONE'],
    ['not_found', undefined, 'NOSUCH']
  ] as const)('answers %s', async (reason, data, code) => {
    if (data) await ctx.prisma.promoCode.create({data})
    const res = await validate(code).expect(200)
    expect(res.body).toEqual({ok: false, reason})
  })

  it('answers not_applicable when no line is in scope', async () => {
    const cases = await ctx.prisma.category.findFirstOrThrow({where: {slug: 'cases'}})
    await ctx.prisma.promoCode.create({
      data: {code: 'CASESONLY', ...percent, categories: {create: {categoryId: cases.id}}}
    })
    const res = await validate('CASESONLY').expect(200)
    expect(res.body).toEqual({ok: false, reason: 'not_applicable'})
  })

  it('discounts only the lines in scope', async () => {
    const vip = await ctx.prisma.product.findFirstOrThrow({where: {slug: 'vip'}})
    await ctx.prisma.promoCode.create({
      data: {code: 'VIPONLY', ...percent, products: {create: {productId: vip.id}}}
    })
    const res = await validate('VIPONLY', {
      lines: [...vip2, {server: 'survival', slug: 'elite', quantity: 1}]
    }).expect(200)
    expect(res.body).toMatchObject({ok: true, subtotalMinor: 1997, discountMinor: 99})
  })

  it('normalizes and never 400s on odd input', async () => {
    await ctx.prisma.promoCode.create({data: {code: 'ASF14', ...percent}})
    expect((await validate(' asf14 ').expect(200)).body).toMatchObject({ok: true, code: 'ASF14'})
    expect((await validate('ASF-14').expect(200)).body).toEqual({ok: false, reason: 'not_found'})
    await validate('A'.repeat(65)).expect(400)
  })

  it('answers 409 unavailable for lines that cannot be sold', async () => {
    const res = await validate('TEN', {
      lines: [{server: 'survival', slug: 'nope', quantity: 1}]
    }).expect(409)
    expect(res.body).toMatchObject({
      message: 'unavailable',
      issues: {lines: [{server: 'survival', slug: 'nope'}]}
    })
  })

  it('rejects an unknown body field', async () => {
    await validate('TEN', {totalMinor: 1}).expect(400)
  })
})
