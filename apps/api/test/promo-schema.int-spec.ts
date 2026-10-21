import {Prisma} from '../src/generated/prisma/client'
import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

describe('promo schema', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>
  beforeAll(async () => {
    ctx = await startCatalogApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const percent = {kind: 'PERCENT', value: 10} as const

  it('refuses a second live code with the same text', async () => {
    await ctx.prisma.promoCode.create({data: {code: 'LIVE1', ...percent}})
    await expect(
      ctx.prisma.promoCode.create({data: {code: 'LIVE1', ...percent}})
    ).rejects.toMatchObject({code: 'P2002'})
  })

  it('allows a new live code next to a soft-deleted one', async () => {
    await ctx.prisma.promoCode.create({
      data: {code: 'ASF14', ...percent, deletedAt: new Date()}
    })
    await ctx.prisma.promoCode.create({data: {code: 'ASF14', ...percent}})
    expect(await ctx.prisma.promoCode.count({where: {code: 'ASF14'}})).toBe(2)
  })

  it('refuses to delete a product or category linked to a promo', async () => {
    const product = await ctx.prisma.product.findFirstOrThrow()
    const promo = await ctx.prisma.promoCode.create({
      data: {
        code: 'SCOPED',
        ...percent,
        products: {create: {productId: product.id}},
        categories: {create: {categoryId: product.categoryId}}
      }
    })
    await expect(ctx.prisma.product.delete({where: {id: product.id}})).rejects.toMatchObject({
      code: 'P2003'
    })
    await expect(
      ctx.prisma.category.delete({where: {id: product.categoryId}})
    ).rejects.toMatchObject({code: 'P2003'})
    await ctx.prisma.promoCode.delete({where: {id: promo.id}})
    expect(await ctx.prisma.promoCodeProduct.count({where: {promoCodeId: promo.id}})).toBe(0)
  })

  it('stores the promo on an order and refuses to delete a used promo', async () => {
    const promo = await ctx.prisma.promoCode.create({data: {code: 'USED', ...percent}})
    const order = await ctx.prisma.order.create({
      data: {
        publicId: `p${String(Date.now()).padStart(21, '0')}`,
        nick: 'Steve',
        email: 'steve@example.com',
        locale: 'en',
        currency: 'EUR',
        subtotalMinor: 500,
        discountMinor: 50,
        totalMinor: 450,
        deliveryConsentAt: new Date(),
        promoCodeId: promo.id,
        promoCode: 'USED'
      }
    })
    expect(order.promoCode).toBe('USED')
    await expect(ctx.prisma.promoCode.delete({where: {id: promo.id}})).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError
    )
  })

  it('gives the ADMIN role promo.write', async () => {
    const rows = await ctx.prisma.$queryRaw<{permissions: string[]}[]>`
      SELECT "permissions" FROM "roles" WHERE "name" = 'ADMIN'`
    expect(rows[0]?.permissions).toContain('promo.write')
  })
})
