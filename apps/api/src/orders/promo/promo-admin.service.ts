import {Injectable} from '@nestjs/common'

import type {AdminPromoCode, PromoActive, PromoCodeInput, PromoCodeUpdate} from '@shop/shared/promo'

import {isPrismaError} from '../../catalog-admin/order'
import {badRequest, conflict, notFound, stale} from '../../common/http-errors'
import {assertUpdated} from '../../common/versioned'
import type {Prisma} from '../../generated/prisma/client'
import {PrismaService} from '../../prisma/prisma.service'
import {promoStatus} from './promo-rules'

const include = {
  categories: {select: {categoryId: true}},
  products: {select: {productId: true}},
  _count: {select: {orders: true}}
} satisfies Prisma.PromoCodeInclude
type Row = Prisma.PromoCodeGetPayload<{include: typeof include}>

const toAdminPromoCode = (r: Row, now = new Date()): AdminPromoCode => {
  const categoryIds = r.categories.map(c => c.categoryId)
  const productIds = r.products.map(p => p.productId)
  return {
    id: r.id,
    code: r.code,
    kind: r.kind,
    value: r.value,
    currency: r.currency,
    maxUses: r.maxUses,
    usedCount: r.usedCount,
    startsAt: r.startsAt?.toISOString() ?? null,
    endsAt: r.endsAt?.toISOString() ?? null,
    isActive: r.isActive,
    status: promoStatus({...r, categoryIds, productIds}, now),
    locked: r.usedCount > 0 || r._count.orders > 0,
    categoryIds,
    productIds,
    version: r.version,
    createdAt: r.createdAt.toISOString()
  }
}

const sameSet = (a: readonly string[], b: readonly string[]) => {
  const left = new Set(a)
  return left.size === new Set(b).size && b.every(id => left.has(id))
}

const codeTaken = (error: unknown): never => {
  if (isPrismaError(error, 'P2002')) throw conflict('code_taken')
  throw error
}

@Injectable()
export class PromoAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminPromoCode[]> {
    const rows = await this.prisma.promoCode.findMany({
      where: {deletedAt: null},
      include,
      orderBy: [{createdAt: 'desc'}, {id: 'desc'}]
    })
    return rows.map(r => toAdminPromoCode(r))
  }

  async get(id: string): Promise<AdminPromoCode> {
    return toAdminPromoCode(await this.live(id))
  }

  async create(input: PromoCodeInput): Promise<AdminPromoCode> {
    await this.assertRefs(input)
    const row = await this.prisma.promoCode
      .create({
        data: {
          code: input.code,
          kind: input.kind,
          value: input.value,
          currency: input.currency,
          maxUses: input.maxUses,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isActive: input.isActive,
          categories: {create: [...new Set(input.categoryIds)].map(categoryId => ({categoryId}))},
          products: {create: [...new Set(input.productIds)].map(productId => ({productId}))}
        },
        include
      })
      .catch(codeTaken)
    return toAdminPromoCode(row)
  }

  async update(
    id: string,
    input: PromoCodeUpdate,
    before: (p: AdminPromoCode) => void
  ): Promise<AdminPromoCode> {
    const current = await this.live(id)
    const view = toAdminPromoCode(current)
    before(view)
    if (current.version !== input.version) throw stale()
    if (view.locked) {
      const changed =
        input.code !== current.code ||
        input.kind !== current.kind ||
        input.value !== current.value ||
        input.currency !== current.currency ||
        !sameSet(view.categoryIds, input.categoryIds) ||
        !sameSet(view.productIds, input.productIds)
      if (changed) throw conflict('promo_locked')
    }
    if (input.maxUses !== null && input.maxUses < current.usedCount)
      throw conflict('max_uses_below_used')
    await this.assertRefs(input)
    const row = await this.prisma
      .$transaction(async tx => {
        const {count} = await tx.promoCode.updateMany({
          where: {
            id,
            version: input.version,
            deletedAt: null,
            // A use counted since the check above must not leave usedCount above the new cap.
            ...(input.maxUses !== null && {usedCount: {lte: input.maxUses}})
          },
          data: {
            code: input.code,
            kind: input.kind,
            value: input.value,
            currency: input.currency,
            maxUses: input.maxUses,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            isActive: input.isActive,
            version: {increment: 1}
          }
        })
        await assertUpdated(
          count,
          async () => (await tx.promoCode.count({where: {id, deletedAt: null}})) > 0
        )
        await tx.promoCodeCategory.deleteMany({where: {promoCodeId: id}})
        await tx.promoCodeProduct.deleteMany({where: {promoCodeId: id}})
        await tx.promoCodeCategory.createMany({
          data: [...new Set(input.categoryIds)].map(categoryId => ({promoCodeId: id, categoryId}))
        })
        await tx.promoCodeProduct.createMany({
          data: [...new Set(input.productIds)].map(productId => ({promoCodeId: id, productId}))
        })
        return tx.promoCode.findUniqueOrThrow({where: {id}, include})
      })
      .catch(codeTaken)
    return toAdminPromoCode(row)
  }

  async setActive(
    id: string,
    input: PromoActive,
    before: (p: AdminPromoCode) => void
  ): Promise<AdminPromoCode> {
    before(toAdminPromoCode(await this.live(id)))
    const {count} = await this.prisma.promoCode.updateMany({
      where: {id, version: input.version, deletedAt: null},
      data: {isActive: input.isActive, version: {increment: 1}}
    })
    await assertUpdated(count, async () => this.exists(id))
    return this.get(id)
  }

  async remove(id: string, version: number, before: (p: AdminPromoCode) => void): Promise<void> {
    before(toAdminPromoCode(await this.live(id)))
    const {count} = await this.prisma.promoCode.updateMany({
      where: {id, version, deletedAt: null},
      data: {deletedAt: new Date(), version: {increment: 1}}
    })
    await assertUpdated(count, async () => this.exists(id))
  }

  private async live(id: string): Promise<Row> {
    const row = await this.prisma.promoCode.findFirst({where: {id, deletedAt: null}, include})
    if (!row) throw notFound()
    return row
  }

  private async exists(id: string): Promise<boolean> {
    return (await this.prisma.promoCode.count({where: {id, deletedAt: null}})) > 0
  }

  private async assertRefs(input: Pick<PromoCodeInput, 'categoryIds' | 'productIds'>) {
    const categoryIds = [...new Set(input.categoryIds)]
    const productIds = [...new Set(input.productIds)]
    const [categories, products] = await Promise.all([
      this.prisma.category.count({where: {id: {in: categoryIds}}}),
      this.prisma.product.count({where: {id: {in: productIds}}})
    ])
    if (categories !== categoryIds.length || products !== productIds.length)
      throw badRequest('invalid')
  }
}
