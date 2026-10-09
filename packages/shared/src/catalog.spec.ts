import * as v from 'valibot'

import {CatalogQuerySchema, CatalogResponseSchema, ProductSectionSchema} from './catalog'

const product = {
  server: 'survival',
  category: 'ranks',
  slug: 'vip',
  kind: 'TIMED',
  durationDays: 30,
  mark: 'VIP',
  icon: 'crown',
  name: 'VIP',
  description: 'Coloured nickname.',
  sections: [
    {title: 'Kits', entries: [{cmd: '/kit vip', text: 'Diamond tools', cooldown: '24 h'}]}
  ],
  prices: {EUR: 499, PLN: 2199}
}

const catalog = {
  servers: [
    {
      slug: 'survival',
      name: 'Survival',
      accent: '#ff6b1a',
      onAccent: '#0e0e10',
      categories: [{slug: 'ranks', name: 'Ranks'}]
    }
  ],
  products: [product]
}

describe('CatalogQuerySchema', () => {
  it.each(['en', 'pl'])('accepts locale %s', locale => {
    expect(v.parse(CatalogQuerySchema, {locale})).toEqual({locale})
  })

  it.each([undefined, 'PL', 'de', ['en', 'pl']])('rejects locale %p', locale => {
    expect(v.safeParse(CatalogQuerySchema, {locale}).success).toBe(false)
  })
})

describe('CatalogResponseSchema', () => {
  it('accepts a valid catalog', () => {
    expect(v.parse(CatalogResponseSchema, catalog)).toEqual(catalog)
  })

  it.each([
    ['a float price', {prices: {EUR: 4.99, PLN: 2199}}],
    ['a zero price', {prices: {EUR: 0, PLN: 2199}}],
    ['an unknown currency', {prices: {EUR: 499, USD: 2199}}],
    ['an unknown icon', {icon: 'star'}],
    ['an unknown kind', {kind: 'RENTAL'}]
  ])('rejects %s', (_, patch) => {
    const bad = {...catalog, products: [{...product, ...patch}]}
    expect(v.safeParse(CatalogResponseSchema, bad).success).toBe(false)
  })
})

describe('ProductSectionSchema', () => {
  it('rejects a section without a title', () => {
    expect(v.safeParse(ProductSectionSchema, {entries: []}).success).toBe(false)
  })
})
