import {Injectable} from '@nestjs/common'

import {CURRENCIES, LOCALES} from '@shop/shared/catalog'
import {
  type AdminProduct,
  type AdminProductListItem,
  type OrderInput,
  type ProductCreate,
  type ProductListQuery,
  type ProductUpdate,
  missingForActive
} from '@shop/shared/catalog-admin'

import {badRequest, conflict, inUse, notFound, stale} from '../common/http-errors'
import {assertUpdated} from '../common/versioned'
import type {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {assertSameOrder, assertSameSet, isPrismaError, serializable} from './order'
import {productInclude, productOmit, toAdminProduct, toListItem} from './products.mapper'

const slugTaken = (error: unknown): never => {
  if (isPrismaError(error, 'P2002')) throw conflict('slug_taken')
  throw error
}

type Tx = Prisma.TransactionClient

/** The product's category must be attached to its server (spec §3 rule 3). */
async function assertPlacement(tx: Tx, serverId: string, categoryId: string): Promise<void> {
  const link = await tx.serverCategory.findUnique({
    where: {serverId_categoryId: {serverId, categoryId}}
  })
  if (!link) throw badRequest('category_not_on_server')
}

async function nextSort(tx: Tx, serverId: string, categoryId: string): Promise<number> {
  const {_max} = await tx.product.aggregate({where: {serverId, categoryId}, _max: {sort: true}})
  return (_max.sort ?? -1) + 1
}

const translationRows = (input: ProductCreate) =>
  LOCALES.flatMap(locale => {
    const t = input.translations[locale]
    return t ? [{locale, ...t, sections: t.sections as Prisma.InputJsonValue}] : []
  })
/** The product's own columns (translations and prices live in their tables). */
const columns = (input: ProductCreate) => ({
  serverId: input.serverId,
  categoryId: input.categoryId,
  slug: input.slug,
  kind: input.kind,
  durationDays: input.durationDays,
  mark: input.mark,
  grantCommands: input.grantCommands,
  revokeCommands: input.revokeCommands
})
const priceRows = (input: ProductCreate) =>
  CURRENCIES.flatMap(currency => {
    const amountMinor = input.prices[currency]
    return amountMinor === null ? [] : [{currency, amountMinor}]
  })

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductListQuery): Promise<AdminProductListItem[]> {
    const rows = await this.prisma.product.findMany({
      where: {serverId: query.serverId, categoryId: query.categoryId},
      include: productInclude,
      omit: productOmit,
      orderBy: [{sort: 'asc'}, {slug: 'asc'}]
    })
    return rows.map(toListItem)
  }

  async get(id: string): Promise<AdminProduct> {
    const row = await this.prisma.product.findUnique({
      where: {id},
      include: productInclude,
      omit: productOmit
    })
    if (!row) throw notFound()
    return toAdminProduct(row)
  }

  /** Created disabled and last in its category (spec decision #5). */
  async create(input: ProductCreate): Promise<AdminProduct> {
    // Serializable, like setCategories: a concurrent detach cannot slip past the placement check.
    const row = await serializable(this.prisma, async tx => {
      await assertPlacement(tx, input.serverId, input.categoryId)
      return tx.product.create({
        data: {
          ...columns(input),
          isActive: false,
          sort: await nextSort(tx, input.serverId, input.categoryId),
          translations: {create: translationRows(input)},
          prices: {create: priceRows(input)}
        },
        include: productInclude,
        omit: productOmit
      })
    }).catch(slugTaken)
    return toAdminProduct(row)
  }

  async update(
    id: string,
    input: ProductUpdate,
    before: (p: AdminProduct) => void
  ): Promise<AdminProduct> {
    const row = await serializable(this.prisma, async tx => {
      const current = await tx.product.findUnique({
        where: {id},
        include: productInclude,
        omit: productOmit
      })
      if (!current) throw notFound()
      // Slug and server are in storefront URLs and cart cookies (spec decision #9).
      if (current.isActive && (input.slug !== current.slug || input.serverId !== current.serverId))
        throw badRequest('slug_locked')
      await assertPlacement(tx, input.serverId, input.categoryId)
      const missing = missingForActive(input)
      if (input.isActive && missing.length > 0) throw badRequest('incomplete', {missing})
      before(toAdminProduct(current))

      const moved = input.serverId !== current.serverId || input.categoryId !== current.categoryId
      const {count} = await tx.product.updateMany({
        where: {id, version: input.version},
        data: {
          ...columns(input),
          isActive: input.isActive,
          ...(moved && {sort: await nextSort(tx, input.serverId, input.categoryId)}),
          version: {increment: 1}
        }
      })
      await assertUpdated(count, async () => (await tx.product.count({where: {id}})) > 0)

      const keepLocales = translationRows(input).map(t => t.locale)
      await tx.productTranslation.deleteMany({
        where: {productId: id, locale: {notIn: keepLocales}}
      })
      for (const t of translationRows(input))
        await tx.productTranslation.upsert({
          where: {productId_locale: {productId: id, locale: t.locale}},
          create: {productId: id, ...t},
          update: t
        })
      const keepCurrencies = priceRows(input).map(p => p.currency)
      await tx.price.deleteMany({where: {productId: id, currency: {notIn: keepCurrencies}}})
      for (const p of priceRows(input))
        await tx.price.upsert({
          where: {productId_currency: {productId: id, currency: p.currency}},
          create: {productId: id, ...p},
          update: {amountMinor: p.amountMinor}
        })
      return tx.product.findUniqueOrThrow({where: {id}, include: productInclude, omit: productOmit})
    }).catch(slugTaken)
    return toAdminProduct(row)
  }

  /** `before` receives the order being replaced, for the audit row. */
  async order(
    serverId: string,
    categoryId: string,
    input: OrderInput,
    before: (ids: string[]) => void
  ): Promise<AdminProductListItem[]> {
    const {ids, base} = input
    await serializable(this.prisma, async tx => {
      const current = (
        await tx.product.findMany({
          where: {serverId, categoryId},
          select: {id: true},
          orderBy: [{sort: 'asc'}, {slug: 'asc'}]
        })
      ).map(p => p.id)
      assertSameSet(current, ids)
      assertSameOrder(current, base)
      before(current)
      for (const [sort, id] of ids.entries()) await tx.product.update({where: {id}, data: {sort}})
    })
    return this.list({serverId, categoryId})
  }

  /** A product that order items reference cannot be deleted (409 `in_use` with the order count). */
  async remove(id: string, version: number, before: (p: AdminProduct) => void): Promise<void> {
    const current = await this.prisma.product.findUnique({
      where: {id},
      include: productInclude,
      omit: productOmit
    })
    if (!current) throw notFound()
    before(toAdminProduct(current))
    const {count} = await this.prisma.product
      .deleteMany({where: {id, version}})
      .catch(async (error: unknown) => {
        if (!isPrismaError(error, 'P2003')) throw error
        const [orders, promoCodes] = await Promise.all([
          this.prisma.orderItem.count({where: {productId: id}}),
          this.prisma.promoCode.count({where: {deletedAt: null, products: {some: {productId: id}}}})
        ])
        throw inUse({orders, promoCodes})
      })
    if (count === 0) throw stale()
  }
}
