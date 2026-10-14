import {TEST_CATALOG} from '@/features/catalog/test-catalog'

import {resolveCart} from './resolve-cart'

const {products} = TEST_CATALOG

describe('resolveCart', () => {
  it('pairs each cookie line with its product', () => {
    const {lines} = resolveCart('survival:vip:2|anarchy:pvp-kit:1', undefined, products)
    expect(lines.map(l => [l.product.name, l.qty])).toEqual([
      ['VIP', 2],
      ['PvP kit', 1]
    ])
  })

  it('drops lines whose product is not in the catalog (or is on another server)', () => {
    const {lines} = resolveCart(
      'survival:vip:1|survival:removed-rank:2|anarchy:vip:1',
      undefined,
      products
    )
    expect(lines.map(l => l.product.slug)).toEqual(['vip'])
  })

  it('has no lines without a catalog', () => {
    expect(resolveCart('survival:vip:1', undefined, []).lines).toEqual([])
  })

  it('takes the currency from its cookie, or the default', () => {
    expect(resolveCart(undefined, 'PLN', products).currency).toBe('PLN')
    expect(resolveCart(undefined, 'XXX', products).currency).toBe('EUR')
    expect(resolveCart(undefined, undefined, products).currency).toBe('EUR')
  })
})
