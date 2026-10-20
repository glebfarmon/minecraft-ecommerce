import {priceLines} from './order-pricing'

type P = Parameters<typeof priceLines>[1][number]
const product = (
  over: Partial<Omit<P, 'server'>> & {slug: string; id: string; server: string}
): P => {
  const {server, ...rest} = over
  return {
    isActive: true,
    serverId: `srv-${server}`,
    server: {slug: server, name: server.toUpperCase(), isActive: true, purchasable: true},
    prices: [{currency: 'EUR', amountMinor: 500}],
    translations: [
      {locale: 'en', name: `${over.slug} en`},
      {locale: 'pl', name: `${over.slug} pl`}
    ],
    ...rest
  }
}

const products = [
  product({id: 'p1', slug: 'vip', server: 'survival'}),
  product({
    id: 'p2',
    slug: 'fly',
    server: 'skyblock',
    prices: [{currency: 'EUR', amountMinor: 250}]
  })
]

describe('priceLines', () => {
  it('prices lines from the database in the order locale', () => {
    const r = priceLines(
      [
        {server: 'survival', slug: 'vip', quantity: 2},
        {server: 'skyblock', slug: 'fly', quantity: 3}
      ],
      products,
      'EUR',
      'en'
    )
    expect(r).toEqual({
      items: [
        {
          productId: 'p1',
          serverId: 'srv-survival',
          quantity: 2,
          unitAmountMinor: 500,
          productName: 'vip en',
          serverName: 'SURVIVAL'
        },
        {
          productId: 'p2',
          serverId: 'srv-skyblock',
          quantity: 3,
          unitAmountMinor: 250,
          productName: 'fly en',
          serverName: 'SKYBLOCK'
        }
      ]
    })
  })

  it('uses the pl name and falls back to en without a pl translation', () => {
    const noPl = product({
      id: 'p3',
      slug: 'x',
      server: 'survival',
      translations: [{locale: 'en', name: 'x en'}]
    })
    const r = priceLines(
      [
        {server: 'survival', slug: 'vip', quantity: 1},
        {server: 'survival', slug: 'x', quantity: 1}
      ],
      [...products, noPl],
      'EUR',
      'pl'
    )
    expect('items' in r && r.items.map(i => i.productName)).toEqual(['vip pl', 'x en'])
  })

  it('lists every unavailable line', () => {
    const inactive = product({id: 'p4', slug: 'off', server: 'survival', isActive: false})
    const offServer = product({id: 'p5', slug: 'on', server: 'dead'})
    offServer.server.isActive = false
    const r = priceLines(
      [
        {server: 'survival', slug: 'vip', quantity: 1},
        {server: 'survival', slug: 'off', quantity: 1},
        {server: 'survival', slug: 'missing', quantity: 1},
        {server: 'dead', slug: 'on', quantity: 1},
        {server: 'skyblock', slug: 'fly', quantity: 1}
      ],
      [...products, inactive, offServer],
      'PLN',
      'en'
    )
    expect(r).toEqual({
      unavailable: [
        {server: 'survival', slug: 'vip'},
        {server: 'survival', slug: 'off'},
        {server: 'survival', slug: 'missing'},
        {server: 'dead', slug: 'on'},
        {server: 'skyblock', slug: 'fly'}
      ]
    })
  })

  it('refuses a product whose server cannot deliver', () => {
    const noRcon = product({id: 'p6', slug: 'rank', server: 'norcon'})
    noRcon.server.purchasable = false
    const r = priceLines([{server: 'norcon', slug: 'rank', quantity: 1}], [noRcon], 'EUR', 'en')
    expect(r).toEqual({unavailable: [{server: 'norcon', slug: 'rank'}]})
  })

  it('keeps client quantities but takes prices only from the database', () => {
    const r = priceLines([{server: 'survival', slug: 'vip', quantity: 99}], products, 'EUR', 'en')
    expect('items' in r && r.items[0]).toMatchObject({quantity: 99, unitAmountMinor: 500})
  })
})
