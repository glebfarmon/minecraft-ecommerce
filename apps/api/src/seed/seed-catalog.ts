import {CURRENCIES, LOCALES} from '@shop/shared/catalog'

import type {PrismaClient} from '../generated/prisma/client'
import {DEMO_CATEGORIES, DEMO_SERVERS} from './demo-catalog'
import {DEMO_PRODUCTS, type Product} from './demo-products'

function required<V>(map: Map<string, V>, key: string): V {
  const value = map.get(key)
  if (value === undefined) throw new Error(`seed: unknown ${key}`)
  return value
}

/** CASE wins over a duration; a duration alone makes a TIMED product. */
function kindOf(p: Product) {
  if (p.adult) return {kind: 'CASE' as const, durationDays: null}
  if (p.durationDays) return {kind: 'TIMED' as const, durationDays: p.durationDays}
  return {kind: 'PERMANENT' as const, durationDays: null}
}

/** Creates whatever is missing and never updates existing rows, so later admin edits survive a re-run. */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const categoryIds = new Map<string, string>()
  for (const c of DEMO_CATEGORIES) {
    const row = await prisma.category.upsert({
      where: {slug: c.slug},
      update: {},
      create: {
        slug: c.slug,
        translations: {create: LOCALES.map(locale => ({locale, name: c.names[locale]}))}
      }
    })
    categoryIds.set(c.slug, row.id)
  }

  for (const [i, s] of DEMO_SERVERS.entries()) {
    const server = await prisma.server.upsert({
      where: {slug: s.slug},
      update: {},
      create: {slug: s.slug, name: s.name, accent: s.accent, onAccent: s.onAccent, sort: i}
    })

    for (const [j, slug] of s.categories.entries()) {
      const categoryId = required(categoryIds, slug)
      await prisma.serverCategory.upsert({
        where: {serverId_categoryId: {serverId: server.id, categoryId}},
        update: {},
        create: {serverId: server.id, categoryId, sort: j}
      })
    }

    for (const [k, p] of DEMO_PRODUCTS.filter(p => p.server === s.slug).entries()) {
      await prisma.product.upsert({
        where: {serverId_slug: {serverId: server.id, slug: p.slug}},
        update: {},
        create: {
          serverId: server.id,
          categoryId: required(categoryIds, p.category),
          slug: p.slug,
          ...kindOf(p),
          mark: p.mark,
          icon: p.icon,
          // Placeholder until delivery (sub-project 5) defines real commands per product.
          grantCommands: [`say [demo] {nick} bought ${p.slug}`],
          revokeCommands: [],
          sort: k,
          translations: {
            create: LOCALES.map(locale => ({
              locale,
              name: p.name,
              description: p.description[locale],
              sections: p.sections?.[locale] ?? []
            }))
          },
          prices: {create: CURRENCIES.map(currency => ({currency, amountMinor: p.price[currency]}))}
        }
      })
    }
  }
}
