import * as v from 'valibot'

import {LOCALES, ProductSectionSchema} from '@shop/shared/catalog'

import {DEMO_CATEGORIES, DEMO_SERVERS} from './demo-catalog'
import {DEMO_PRODUCTS} from './demo-products'

describe('demo catalog', () => {
  it('has 3 servers, 5 categories and 20 products', () => {
    expect([DEMO_SERVERS.length, DEMO_CATEGORIES.length, DEMO_PRODUCTS.length]).toEqual([3, 5, 20])
  })

  it('puts every product on a known server, in a category that server lists', () => {
    for (const p of DEMO_PRODUCTS) {
      const server = DEMO_SERVERS.find(s => s.slug === p.server)
      expect(server?.categories).toContain(p.category)
    }
  })

  it('has unique slugs per server', () => {
    const keys = DEMO_PRODUCTS.map(p => `${p.server}/${p.slug}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has valid sections and positive prices in both currencies', () => {
    for (const p of DEMO_PRODUCTS) {
      for (const locale of LOCALES)
        expect(v.safeParse(v.array(ProductSectionSchema), p.sections?.[locale] ?? []).success).toBe(
          true
        )
      expect(p.price.EUR).toBeGreaterThan(0)
      expect(p.price.PLN).toBeGreaterThan(0)
    }
  })
})
