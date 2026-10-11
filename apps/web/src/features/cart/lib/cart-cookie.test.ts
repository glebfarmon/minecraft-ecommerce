import {CART_COOKIE, MAX_LINES} from '@/config/cart'

import {parseCart, serializeCart, writeCartCookie} from './cart-cookie'

describe('cart cookie', () => {
  it('round-trips lines', () => {
    const lines = [
      {server: 'survival', slug: 'vip', qty: 1},
      {server: 'anarchy', slug: 'coins-1000', qty: 3}
    ]
    expect(serializeCart(lines)).toBe('survival:vip:1|anarchy:coins-1000:3')
    expect(parseCart(serializeCart(lines))).toEqual(lines)
  })

  it('is empty for a missing or empty cookie', () => {
    expect(parseCart(undefined)).toEqual([])
    expect(parseCart('')).toEqual([])
  })

  it('keeps only well-formed lines', () => {
    const raw = [
      'garbage',
      'a:b',
      'survival:VIP:1',
      'survival:vip:x',
      ':vip:1',
      'survival:vip:1:extra',
      'survival:vip:-1',
      'survival:vip:1.5',
      'survival:vip:0',
      'anarchy:pvp-kit:2'
    ].join('|')
    expect(parseCart(raw)).toEqual([{server: 'anarchy', slug: 'pvp-kit', qty: 2}])
  })

  it('clamps quantities to 99 and merges duplicates', () => {
    expect(parseCart('survival:vip:5000')).toEqual([{server: 'survival', slug: 'vip', qty: 99}])
    expect(parseCart('survival:vip:60|survival:vip:60')).toEqual([
      {server: 'survival', slug: 'vip', qty: 99}
    ])
  })

  it(`keeps at most ${String(MAX_LINES)} lines`, () => {
    const raw = Array.from({length: MAX_LINES + 1}, (_, i) => `survival:p${String(i)}:1`).join('|')
    const lines = parseCart(raw)
    expect(lines).toHaveLength(MAX_LINES)
    expect(lines.at(-1)?.slug).toBe(`p${String(MAX_LINES - 1)}`)
  })

  it('fits the maximum cart with long slugs into one 4 KB cookie', () => {
    const long = 'x'.repeat(40)
    const lines = Array.from({length: MAX_LINES}, (_, i) => ({
      server: long,
      slug: `${long.slice(2)}${String(i).padStart(2, '0')}`,
      qty: 99
    }))
    expect(`${CART_COOKIE}=${serializeCart(lines)}`.length).toBeLessThanOrEqual(4096)
  })

  it('writes the cookie for the whole site', () => {
    writeCartCookie([{server: 'survival', slug: 'vip', qty: 2}])
    expect(document.cookie).toContain('cart=survival:vip:2')
    document.cookie = 'cart=; path=/; max-age=0'
  })
})
