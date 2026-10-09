import * as v from 'valibot'

import {
  type CatalogProduct,
  type CatalogResponse,
  type Currency,
  type Locale,
  type ProductIcon,
  type ProductKind,
  ProductSectionSchema
} from '@shop/shared/catalog'

type Translated<T> = T & {locale: Locale}

/** What CatalogService selects; plain shapes so the mapper is testable without Prisma. */
export type CatalogRows = {
  servers: {
    slug: string
    name: string
    accent: string
    onAccent: string
    categories: {category: {slug: string; translations: Translated<{name: string}>[]}}[]
  }[]
  products: {
    slug: string
    kind: ProductKind
    durationDays: number | null
    mark: string
    icon: ProductIcon
    server: {slug: string}
    category: {slug: string}
    translations: Translated<{name: string; description: string; sections: unknown}>[]
    prices: {currency: Currency; amountMinor: number}[]
  }[]
}

const Sections = v.array(ProductSectionSchema)

function pick<T extends {locale: Locale}>(rows: T[], locale: Locale): T | undefined {
  return rows.find(r => r.locale === locale) ?? rows.find(r => r.locale === 'en')
}

/** Public catalog for `locale`: falls back to `en`, drops unsellable products (and says why), never leaks commands. */
export function toCatalogResponse(
  rows: CatalogRows,
  locale: Locale,
  warn: (message: string) => void
): CatalogResponse {
  const servers = rows.servers.map(s => ({
    slug: s.slug,
    name: s.name,
    accent: s.accent,
    onAccent: s.onAccent,
    categories: s.categories.flatMap(({category}) => {
      const text = pick(category.translations, locale)
      return text ? [{slug: category.slug, name: text.name}] : []
    })
  }))

  const products = rows.products.flatMap((p): CatalogProduct[] => {
    const id = `${p.server.slug}/${p.slug}`
    const text = pick(p.translations, locale)
    if (!text) {
      warn(`catalog: ${id} has no ${locale} or en text, skipped`)
      return []
    }
    const eur = p.prices.find(x => x.currency === 'EUR')
    const pln = p.prices.find(x => x.currency === 'PLN')
    if (!eur || !pln) {
      warn(`catalog: ${id} lacks a EUR or PLN price, skipped`)
      return []
    }
    return [
      {
        server: p.server.slug,
        category: p.category.slug,
        slug: p.slug,
        kind: p.kind,
        durationDays: p.durationDays,
        mark: p.mark,
        icon: p.icon,
        name: text.name,
        description: text.description,
        // Malformed JSON in the database fails the request (500, logged) rather than reaching the storefront.
        sections: v.parse(Sections, text.sections),
        prices: {EUR: eur.amountMinor, PLN: pln.amountMinor}
      }
    ]
  })

  return {servers, products}
}
