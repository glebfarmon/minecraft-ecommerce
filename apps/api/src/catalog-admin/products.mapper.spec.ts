import {toAdminProduct, toListItem} from './products.mapper'

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
  category: {icon: 'swords' as const},
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

  it('has no icon of its own', () => {
    expect(toAdminProduct(row)).not.toHaveProperty('icon')
  })
})

describe('toListItem', () => {
  it("shows the category's icon", () => {
    expect(toListItem(row).icon).toBe('swords')
  })
})
