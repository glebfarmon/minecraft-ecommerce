import * as v from 'valibot'

import {LOCALES, ProductSectionSchema} from '@shop/shared/catalog'
import {
  type AdminProduct,
  type AdminProductListItem,
  missingForActive
} from '@shop/shared/catalog-admin'

import type {Prisma} from '../generated/prisma/client'

export const productInclude = {
  translations: true,
  prices: true,
  // The tile icon belongs to the category; the list shows it, the product itself has none.
  category: {select: {icon: true}}
} satisfies Prisma.ProductInclude
export type ProductRow = Prisma.ProductGetPayload<{include: typeof productInclude}>

const Sections = v.array(ProductSectionSchema)

const pricesOf = (r: Pick<ProductRow, 'prices'>): AdminProduct['prices'] => ({
  EUR: r.prices.find(p => p.currency === 'EUR')?.amountMinor ?? null,
  PLN: r.prices.find(p => p.currency === 'PLN')?.amountMinor ?? null
})

const translationsOf = (r: Pick<ProductRow, 'translations'>): AdminProduct['translations'] => {
  const one = (locale: (typeof LOCALES)[number]) => {
    const t = r.translations.find(x => x.locale === locale)
    // Same rule as the public catalog: stored sections must match the shared schema.
    return t
      ? {name: t.name, description: t.description, sections: v.parse(Sections, t.sections)}
      : null
  }
  return {en: one('en'), pl: one('pl')}
}

export function toAdminProduct(r: ProductRow): AdminProduct {
  const prices = pricesOf(r)
  const translations = translationsOf(r)
  return {
    id: r.id,
    version: r.version,
    sort: r.sort,
    serverId: r.serverId,
    categoryId: r.categoryId,
    slug: r.slug,
    kind: r.kind,
    durationDays: r.durationDays,
    mark: r.mark,
    isActive: r.isActive,
    grantCommands: r.grantCommands,
    revokeCommands: r.revokeCommands,
    prices,
    translations,
    missing: missingForActive({prices, translations})
  }
}

export function toListItem(r: ProductRow): AdminProductListItem {
  const p = toAdminProduct(r)
  const icon = r.category.icon
  return {
    id: p.id,
    version: p.version,
    sort: p.sort,
    serverId: p.serverId,
    categoryId: p.categoryId,
    slug: p.slug,
    kind: p.kind,
    mark: p.mark,
    icon,
    name: p.translations.en?.name ?? p.slug,
    isActive: p.isActive,
    prices: p.prices,
    missing: p.missing
  }
}
