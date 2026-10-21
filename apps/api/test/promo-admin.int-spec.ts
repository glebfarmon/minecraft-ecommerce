import {PromoAdminService} from '../src/orders/promo/promo-admin.service'
import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startCatalogApp>>
beforeAll(async () => {
  ctx = await startCatalogApp()
})
afterAll(async () => {
  await ctx.stop()
})

const base = '/api/admin/promo-codes'
const input = {
  code: 'SUMMER',
  kind: 'PERCENT',
  value: 10,
  currency: null,
  maxUses: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  categoryIds: [] as string[],
  productIds: [] as string[]
}
const writer = () => ctx.admin({permissions: ['promo.write']})
type Promo = {id: string; version: number; locked: boolean; status: string; code: string}

describe('admin promo codes', () => {
  it('refuses SUPPORT', async () => {
    const support = await ctx.admin('SUPPORT')
    await support.get(base).expect(403)
    await support.post(base).send(input).expect(403)
  })

  it('creates, reads, updates, toggles and deletes a code, auditing each write', async () => {
    const a = await writer()
    const category = await ctx.prisma.category.findFirstOrThrow()
    const product = await ctx.prisma.product.findFirstOrThrow()
    const created = await a
      .post(base)
      .send({...input, code: 'ROUNDTRIP', categoryIds: [category.id], productIds: [product.id]})
      .expect(201)
    const row = created.body as Promo
    expect(created.body).toMatchObject({
      code: 'ROUNDTRIP',
      usedCount: 0,
      status: 'active',
      locked: false,
      version: 1,
      categoryIds: [category.id],
      productIds: [product.id]
    })

    const got = await a.get(`${base}/${row.id}`).expect(200)
    expect(got.body).toMatchObject({id: row.id, code: 'ROUNDTRIP'})

    const updated = await a
      .patch(`${base}/${row.id}`)
      .send({...input, code: 'ROUNDTRIP', value: 25, version: 1})
      .expect(200)
    expect(updated.body).toMatchObject({value: 25, version: 2, categoryIds: [], productIds: []})

    const off = await a
      .patch(`${base}/${row.id}/active`)
      .send({isActive: false, version: 2})
      .expect(200)
    expect(off.body).toMatchObject({isActive: false, status: 'disabled', version: 3})

    await a.delete(`${base}/${row.id}?version=3`).expect(204)
    await a.get(`${base}/${row.id}`).expect(404)

    const rows = await ctx.prisma.auditLog.findMany({where: {entityId: row.id}})
    expect(rows.map(r => r.action).sort()).toEqual(
      ['promo.create', 'promo.delete', 'promo.update', 'promo.update'].sort()
    )
  })

  it('lists live codes newest first and hides deleted ones', async () => {
    const a = await writer()
    const first = (
      await a
        .post(base)
        .send({...input, code: 'LISTA'})
        .expect(201)
    ).body as Promo
    await new Promise(r => setTimeout(r, 5))
    const second = (
      await a
        .post(base)
        .send({...input, code: 'LISTB'})
        .expect(201)
    ).body as Promo
    await a.delete(`${base}/${first.id}?version=1`).expect(204)
    const res = await a.get(base).expect(200)
    const codes = (res.body as Promo[]).map(p => p.code)
    expect(codes).toContain('LISTB')
    expect(codes).not.toContain('LISTA')
    expect((res.body as Promo[])[0]?.id).toBe(second.id)
  })

  it('locks the discount of a used code but not its end date', async () => {
    const a = await writer()
    const used = await ctx.prisma.promoCode.create({
      data: {code: 'USEDONE', kind: 'PERCENT', value: 10, usedCount: 2}
    })
    const got = await a.get(`${base}/${used.id}`).expect(200)
    expect(got.body).toMatchObject({locked: true})

    await a
      .patch(`${base}/${used.id}`)
      .send({...input, code: 'USEDONE', value: 50, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'promo_locked'})
      })

    const ends = new Date(Date.now() + 86_400_000).toISOString()
    const ok = await a
      .patch(`${base}/${used.id}`)
      .send({...input, code: 'USEDONE', endsAt: ends, maxUses: 5, version: 1})
      .expect(200)
    expect(ok.body).toMatchObject({endsAt: ends, maxUses: 5, locked: true})
  })

  it('locks a code that has an order even when usedCount is 0', async () => {
    const a = await writer()
    const promo = await ctx.prisma.promoCode.create({
      data: {code: 'ORDERED', kind: 'PERCENT', value: 10}
    })
    await ctx.prisma.order.create({
      data: {
        publicId: 'promo-admin-order-1',
        nick: 'Steve',
        email: 'steve@example.com',
        locale: 'en',
        currency: 'EUR',
        subtotalMinor: 500,
        totalMinor: 500,
        deliveryConsentAt: new Date(),
        promoCodeId: promo.id,
        promoCode: 'ORDERED'
      }
    })
    const got = await a.get(`${base}/${promo.id}`).expect(200)
    expect(got.body).toMatchObject({locked: true, usedCount: 0})
    await a
      .patch(`${base}/${promo.id}`)
      .send({...input, code: 'ORDERED', value: 50, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'promo_locked'})
      })
  })

  it('does not change the value of a code used between the read and the write', async () => {
    const a = await writer()
    const promo = await ctx.prisma.promoCode.create({
      data: {code: 'RACE', kind: 'PERCENT', value: 10}
    })
    const service = ctx.app.get(PromoAdminService)
    const original = (service as unknown as {assertRefs: (i: unknown) => Promise<void>}).assertRefs
    // assertRefs runs after the locked check read the row and before the write: a use lands here.
    const spy = jest
      .spyOn(service as unknown as {assertRefs: (i: unknown) => Promise<void>}, 'assertRefs')
      .mockImplementationOnce(async function (this: unknown, i: unknown) {
        await ctx.prisma.promoCode.update({where: {id: promo.id}, data: {usedCount: 1}})
        return original.call(this, i)
      })
    await a
      .patch(`${base}/${promo.id}`)
      .send({...input, code: 'RACE', value: 90, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'stale'})
      })
    spy.mockRestore()
    expect((await ctx.prisma.promoCode.findUniqueOrThrow({where: {id: promo.id}})).value).toBe(10)
    await a
      .patch(`${base}/${promo.id}`)
      .send({...input, code: 'RACE', value: 90, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'promo_locked'})
      })
  })

  it('refuses maxUses below usedCount', async () => {
    const a = await writer()
    const used = await ctx.prisma.promoCode.create({
      data: {code: 'USEDTHREE', kind: 'PERCENT', value: 10, usedCount: 3}
    })
    await a
      .patch(`${base}/${used.id}`)
      .send({...input, code: 'USEDTHREE', maxUses: 2, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'max_uses_below_used'})
      })
  })

  it('answers code_taken for a live duplicate, but allows reusing a deleted code', async () => {
    const a = await writer()
    const first = (
      await a
        .post(base)
        .send({...input, code: 'DUPE'})
        .expect(201)
    ).body as Promo
    await a
      .post(base)
      .send({...input, code: 'DUPE'})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'code_taken'})
      })
    const other = (
      await a
        .post(base)
        .send({...input, code: 'DUPE2'})
        .expect(201)
    ).body as Promo
    await a
      .patch(`${base}/${other.id}`)
      .send({...input, code: 'DUPE', version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'code_taken'})
      })
    await a.delete(`${base}/${first.id}?version=1`).expect(204)
    await a
      .post(base)
      .send({...input, code: 'DUPE'})
      .expect(201)
  })

  it('answers stale for an old version and 400 for unknown ids', async () => {
    const a = await writer()
    const row = (
      await a
        .post(base)
        .send({...input, code: 'STALEONE'})
        .expect(201)
    ).body as Promo
    await a
      .patch(`${base}/${row.id}`)
      .send({...input, code: 'STALEONE', value: 20, version: 1})
      .expect(200)
    await a
      .patch(`${base}/${row.id}`)
      .send({...input, code: 'STALEONE', value: 30, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'stale'})
      })
    await a
      .patch(`${base}/${row.id}/active`)
      .send({isActive: false, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'stale'})
      })
    await a.delete(`${base}/${row.id}?version=1`).expect(409)
    await a
      .post(base)
      .send({...input, code: 'BADREF', categoryIds: ['nope']})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'invalid'})
      })
    await a
      .post(base)
      .send({...input, code: 'BADREF', productIds: ['nope']})
      .expect(400)
  })

  it('answers 404 for an unknown id', async () => {
    const a = await writer()
    await a.get(`${base}/nope`).expect(404)
    await a.delete(`${base}/nope?version=1`).expect(404)
  })
})
