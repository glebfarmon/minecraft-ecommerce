import {type CatalogRows, toCatalogResponse} from './catalog.mapper'

const product = (overrides: Partial<CatalogRows['products'][number]> = {}) => ({
  slug: 'vip',
  kind: 'TIMED' as const,
  durationDays: 30,
  mark: 'VIP',
  icon: 'crown' as const,
  server: {slug: 'survival'},
  category: {slug: 'ranks'},
  translations: [
    {locale: 'en' as const, name: 'VIP', description: 'EN text', sections: []},
    {
      locale: 'pl' as const,
      name: 'VIP',
      description: 'PL tekst',
      sections: [{title: 'Zestawy', entries: []}]
    }
  ],
  prices: [
    {currency: 'EUR' as const, amountMinor: 499},
    {currency: 'PLN' as const, amountMinor: 2199}
  ],
  ...overrides
})

const rows = (products = [product()]): CatalogRows => ({
  servers: [
    {
      slug: 'survival',
      name: 'Survival',
      accent: '#ff6b1a',
      onAccent: '#0e0e10',
      categories: [
        {category: {slug: 'kits', translations: [{locale: 'en', name: 'Kits'}]}},
        {
          category: {
            slug: 'ranks',
            translations: [
              {locale: 'en', name: 'Ranks'},
              {locale: 'pl', name: 'Rangi'}
            ]
          }
        }
      ]
    }
  ],
  products
})

describe('toCatalogResponse', () => {
  it('uses the requested locale', () => {
    const res = toCatalogResponse(rows(), 'pl', jest.fn())
    expect(res.products[0]).toEqual({
      server: 'survival',
      category: 'ranks',
      slug: 'vip',
      kind: 'TIMED',
      durationDays: 30,
      mark: 'VIP',
      icon: 'crown',
      name: 'VIP',
      description: 'PL tekst',
      sections: [{title: 'Zestawy', entries: []}],
      prices: {EUR: 499, PLN: 2199}
    })
  })

  it('falls back to en for missing translations, keeping server category order', () => {
    const res = toCatalogResponse(rows(), 'pl', jest.fn())
    expect(res.servers[0]?.categories).toEqual([
      {slug: 'kits', name: 'Kits'},
      {slug: 'ranks', name: 'Rangi'}
    ])
  })

  it('omits and reports a product without text in the locale or en', () => {
    const warn = jest.fn()
    const orphan = product({
      slug: 'orphan',
      translations: [{locale: 'pl', name: 'X', description: 'Y', sections: []}]
    })
    const res = toCatalogResponse(rows([product(), orphan]), 'en', warn)
    expect(res.products.map(p => p.slug)).toEqual(['vip'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('survival/orphan'))
  })

  it('omits and reports a product missing a currency', () => {
    const warn = jest.fn()
    const noPln = product({prices: [{currency: 'EUR', amountMinor: 499}]})
    expect(toCatalogResponse(rows([noPln]), 'en', warn).products).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('price'))
  })

  it('never exposes commands or RCON fields', () => {
    const withSecrets = {
      ...product(),
      grantCommands: ['lp user {nick} parent add vip'],
      rconPasswordEnc: 'secret'
    }
    const json = JSON.stringify(toCatalogResponse(rows([withSecrets]), 'en', jest.fn()))
    expect(json).not.toMatch(/grantCommands|rcon|secret|parent add/)
  })

  it('throws on malformed sections instead of shipping them', () => {
    const bad = product({
      translations: [{locale: 'en', name: 'X', description: 'Y', sections: [{entries: 'nope'}]}]
    })
    expect(() => toCatalogResponse(rows([bad]), 'en', jest.fn())).toThrow()
  })
})
