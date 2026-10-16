import {toAdminProduct} from './products.mapper'

const row = {
  id: 'p1',
  version: 2,
  sort: 0,
  serverId: 's1',
  categoryId: 'c1',
  slug: 'vip',
  kind: 'PERMANENT' as const,
  durationDays: null,
  mark: 'VIP',
  icon: 'crown' as const,
  isActive: false,
  grantCommands: ['lp user {nick} parent add vip'],
  revokeCommands: [],
  translations: [
    {productId: 'p1', locale: 'en' as const, name: 'VIP', description: 'd', sections: []}
  ],
  prices: [{productId: 'p1', currency: 'EUR' as const, amountMinor: 499}]
}

describe('toAdminProduct', () => {
  it('fills missing locales and currencies with null and lists them as missing', () => {
    const p = toAdminProduct(row)
    expect(p.prices).toEqual({EUR: 499, PLN: null})
    expect(p.translations).toEqual({en: {name: 'VIP', description: 'd', sections: []}, pl: null})
    expect(p.missing).toEqual(['price.PLN', 'translation.pl'])
  })
})
