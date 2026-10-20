import {randomBytes} from 'node:crypto'

import {type CatalogRows, toCatalogResponse} from './catalog.mapper'

const savedKey = process.env.RCON_ENCRYPTION_KEY
beforeAll(() => {
  process.env.RCON_ENCRYPTION_KEY = randomBytes(32).toString('base64')
})
afterAll(() => {
  if (savedKey === undefined) delete process.env.RCON_ENCRYPTION_KEY
  else process.env.RCON_ENCRYPTION_KEY = savedKey
})

const product = (overrides: Partial<CatalogRows['products'][number]> = {}) => ({
  slug: 'vip',
  kind: 'TIMED' as const,
  durationDays: 30,
  mark: 'VIP',
  server: {slug: 'survival'},
  category: {slug: 'ranks', icon: 'crown' as const},
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
      rconHost: 'mc.example.com',
      rconPort: 25575,
      rconPasswordEnc: 'v1:a:b:c',
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

  it("takes each product's icon from its category", () => {
    const kit = product({slug: 'starter', category: {slug: 'kits', icon: 'box'}})
    const res = toCatalogResponse(rows([product(), kit]), 'en', jest.fn())
    expect(res.products.map(p => [p.slug, p.icon])).toEqual([
      ['vip', 'crown'],
      ['starter', 'box']
    ])
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

  it('marks a server purchasable only with a complete RCON setup', () => {
    const ready = rows()
    expect(toCatalogResponse(ready, 'en', jest.fn()).servers[0]?.purchasable).toBe(true)
    const [server] = ready.servers
    if (!server) throw new Error('no server')
    const without = {...ready, servers: [{...server, rconHost: null}]}
    const res = toCatalogResponse(without, 'en', jest.fn())
    expect(res.servers[0]?.purchasable).toBe(false)
    expect(res.products).toHaveLength(1)
  })

  it('never exposes commands or RCON fields', () => {
    const withSecrets = {
      ...product(),
      grantCommands: ['lp user {nick} parent add vip'],
      rconPasswordEnc: 'secret'
    }
    const json = JSON.stringify(toCatalogResponse(rows([withSecrets]), 'en', jest.fn()))
    expect(json).not.toMatch(/grantCommands|rcon|secret|parent add|mc\.example|25575/)
  })

  it('throws on malformed sections instead of shipping them', () => {
    const bad = product({
      translations: [{locale: 'en', name: 'X', description: 'Y', sections: [{entries: 'nope'}]}]
    })
    expect(() => toCatalogResponse(rows([bad]), 'en', jest.fn())).toThrow()
  })
})
