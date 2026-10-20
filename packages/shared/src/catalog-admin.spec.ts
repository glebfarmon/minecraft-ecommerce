import * as v from 'valibot'

import {
  CategoryInputSchema,
  CategoryUpdateSchema,
  OrderInputSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  RconInputSchema,
  ServerCategoriesInputSchema,
  ServerCreateSchema,
  ServerUpdateSchema,
  VersionQuerySchema,
  fromMinor,
  hasOnlyNickPlaceholder,
  missingForActive,
  toMinor
} from './catalog-admin'

const product = {
  serverId: 's1',
  categoryId: 'c1',
  slug: 'vip',
  kind: 'PERMANENT' as const,
  durationDays: null,
  mark: 'VIP',
  grantCommands: ['lp user {nick} parent add vip'],
  revokeCommands: [],
  prices: {EUR: 499, PLN: null},
  translations: {en: {name: 'VIP', description: '', sections: []}, pl: null}
}

describe('toMinor / fromMinor', () => {
  it.each([
    ['9.99', 999],
    ['9', 900],
    ['9.9', 990],
    ['9,99', 999],
    [' 12.50 ', 1250]
  ])('%s → %d', (text, minor) => {
    expect(toMinor(text)).toBe(minor)
  })

  it.each(['', '9.999', '-1', 'abc', '1e3', '9.'])('refuses %p', text => {
    expect(toMinor(text)).toBeNull()
  })

  it('formats minor units with two decimals', () => {
    expect(fromMinor(999)).toBe('9.99')
    expect(fromMinor(1205)).toBe('12.05')
    expect(fromMinor(100)).toBe('1.00')
  })
})

describe('hasOnlyNickPlaceholder', () => {
  it('accepts {nick} and plain text', () => {
    expect(hasOnlyNickPlaceholder('give {nick} diamond 1')).toBe(true)
    expect(hasOnlyNickPlaceholder('say hello')).toBe(true)
  })

  it('refuses any other placeholder', () => {
    expect(hasOnlyNickPlaceholder('give {player} diamond')).toBe(false)
    expect(hasOnlyNickPlaceholder('op {nick} {}')).toBe(false)
  })
})

describe('missingForActive', () => {
  it('names each missing price and translation', () => {
    expect(missingForActive(product)).toEqual(['price.PLN', 'translation.pl'])
  })

  it('is empty for a complete product', () => {
    expect(
      missingForActive({
        prices: {EUR: 1, PLN: 1},
        translations: {en: product.translations.en, pl: product.translations.en}
      })
    ).toEqual([])
  })
})

describe('ProductCreateSchema', () => {
  it('accepts an incomplete draft', () => {
    expect(v.safeParse(ProductCreateSchema, product).success).toBe(true)
  })

  it('refuses a command with another placeholder', () => {
    const result = v.safeParse(ProductCreateSchema, {
      ...product,
      grantCommands: ['give {player} 1']
    })
    expect(result.success).toBe(false)
  })

  it('needs durationDays exactly for TIMED products', () => {
    expect(v.safeParse(ProductCreateSchema, {...product, kind: 'TIMED'}).success).toBe(false)
    expect(
      v.safeParse(ProductCreateSchema, {...product, kind: 'TIMED', durationDays: 30}).success
    ).toBe(true)
    expect(v.safeParse(ProductCreateSchema, {...product, durationDays: 30}).success).toBe(false)
  })

  it('refuses a slug the cart cookie cannot hold', () => {
    expect(v.safeParse(ProductCreateSchema, {...product, slug: 'VIP Rank'}).success).toBe(false)
  })

  it('refuses a float price', () => {
    expect(
      v.safeParse(ProductCreateSchema, {...product, prices: {EUR: 4.99, PLN: null}}).success
    ).toBe(false)
  })
})

describe('ProductUpdateSchema', () => {
  it('needs a version and isActive', () => {
    expect(v.safeParse(ProductUpdateSchema, product).success).toBe(false)
    expect(
      v.safeParse(ProductUpdateSchema, {...product, isActive: false, version: 1}).success
    ).toBe(true)
  })
})

describe('icon lives on the category', () => {
  const names = {en: 'Ranks', pl: 'Rangi'}

  it('category input and update need a known icon', () => {
    expect(v.safeParse(CategoryInputSchema, {slug: 'ranks', names}).success).toBe(false)
    expect(v.safeParse(CategoryInputSchema, {slug: 'ranks', names, icon: 'star'}).success).toBe(
      false
    )
    expect(v.parse(CategoryInputSchema, {slug: 'ranks', names, icon: 'box'}).icon).toBe('box')
    expect(
      v.parse(CategoryUpdateSchema, {slug: 'ranks', names, icon: 'coins', version: 1}).icon
    ).toBe('coins')
  })

  it('product input with an icon drops it, like any unknown key', () => {
    const create = v.parse(ProductCreateSchema, {...product, icon: 'crown'})
    expect(create).not.toHaveProperty('icon')
    const update = v.parse(ProductUpdateSchema, {
      ...product,
      icon: 'crown',
      isActive: false,
      version: 1
    })
    expect(update).not.toHaveProperty('icon')
  })
})

describe('other inputs', () => {
  it('refuses duplicate ids in an order', () => {
    expect(v.safeParse(OrderInputSchema, {ids: ['a', 'a'], base: ['a']}).success).toBe(false)
    expect(v.safeParse(OrderInputSchema, {ids: [], base: []}).success).toBe(false)
  })

  it('needs the order a reorder was made from', () => {
    expect(v.safeParse(OrderInputSchema, {ids: ['b', 'a']}).success).toBe(false)
    expect(v.safeParse(OrderInputSchema, {ids: ['b', 'a'], base: ['a', 'b']}).success).toBe(true)
    expect(v.safeParse(OrderInputSchema, {ids: ['b', 'a'], base: ['a', 'a']}).success).toBe(false)
    expect(v.safeParse(OrderInputSchema, {ids: ['b', 'a'], base: []}).success).toBe(false)
    expect(v.safeParse(ServerCategoriesInputSchema, {categoryIds: ['a']}).success).toBe(false)
    expect(v.safeParse(ServerCategoriesInputSchema, {categoryIds: ['a'], base: []}).success).toBe(
      true
    )
    expect(
      v.safeParse(ServerCategoriesInputSchema, {categoryIds: [], base: ['a', 'a']}).success
    ).toBe(false)
  })

  it('needs host and port together, and a password or clearPassword, not both', () => {
    expect(v.safeParse(RconInputSchema, {host: 'mc.example.com', port: null}).success).toBe(false)
    expect(
      v.safeParse(RconInputSchema, {
        host: 'mc.example.com',
        port: 25575,
        password: 'x',
        clearPassword: true
      }).success
    ).toBe(false)
    expect(
      v.safeParse(RconInputSchema, {host: 'mc.example.com', port: 25575, password: 'x'}).success
    ).toBe(true)
  })

  it('checks server colors', () => {
    const server = {slug: 'survival', name: 'Survival', accent: '#ff6b1a', onAccent: '#000000'}
    expect(v.safeParse(ServerCreateSchema, server).success).toBe(true)
    expect(v.safeParse(ServerCreateSchema, {...server, accent: 'orange'}).success).toBe(false)
  })

  it('reads the version from the query string', () => {
    expect(v.parse(VersionQuerySchema, {version: '3'})).toEqual({version: 3})
    expect(v.safeParse(VersionQuerySchema, {version: '0'}).success).toBe(false)
  })

  it('refuses versions beyond the database integer range', () => {
    expect(v.parse(VersionQuerySchema, {version: '2147483647'})).toEqual({version: 2147483647})
    expect(v.safeParse(VersionQuerySchema, {version: '2147483648'}).success).toBe(false)
    const server = {
      slug: 'survival',
      name: 'Survival',
      accent: '#ff6b1a',
      onAccent: '#000000',
      isActive: true
    }
    expect(v.safeParse(ServerUpdateSchema, {...server, version: 2_147_483_647}).success).toBe(true)
    expect(v.safeParse(ServerUpdateSchema, {...server, version: 2_147_483_648}).success).toBe(false)
  })
})
