import type {Currency} from '@shop/shared/catalog'

import {
  type DiscountLine,
  type PromoRow,
  checkAvailable,
  computeDiscount,
  promoStatus
} from './promo-rules'

const now = new Date('2026-10-21T12:00:00Z')
const row = (over: Partial<PromoRow> = {}): PromoRow => ({
  kind: 'PERCENT',
  value: 10,
  currency: null,
  maxUses: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  deletedAt: null,
  categoryIds: [],
  productIds: [],
  ...over
})
const line = (productId: string, categoryId: string, amountMinor: number): DiscountLine => ({
  productId,
  categoryId,
  amountMinor
})
const eur: Currency = 'EUR'

describe('computeDiscount', () => {
  it('floors a percent of the eligible amount', () => {
    expect(computeDiscount(row({value: 15}), [line('p', 'c', 1999)], eur)).toEqual({
      discountMinor: 299
    })
  })
  it('limits a fixed discount to the eligible amount', () => {
    const r = row({kind: 'FIXED', value: 500, currency: 'EUR', productIds: ['p']})
    const lines = [line('p', 'c', 300), line('q', 'c', 1000)]
    expect(computeDiscount(r, lines, eur)).toEqual({discountMinor: 300})
  })
  it('rejects a fixed discount in another currency', () => {
    const r = row({kind: 'FIXED', value: 500, currency: 'EUR'})
    expect(computeDiscount(r, [line('p', 'c', 3000)], 'PLN')).toEqual({reason: 'wrong_currency'})
  })
  it('scopes by category', () => {
    const lines = [line('a', 'c1', 1000), line('b', 'c2', 1000)]
    expect(computeDiscount(row({value: 50, categoryIds: ['c2']}), lines, eur)).toEqual({
      discountMinor: 500
    })
  })
  it('scopes by product', () => {
    const lines = [line('a', 'c1', 1000), line('b', 'c2', 2000)]
    expect(computeDiscount(row({value: 50, productIds: ['a']}), lines, eur)).toEqual({
      discountMinor: 500
    })
  })
  it('applies to everything when scope is empty', () => {
    const lines = [line('a', 'c1', 1000), line('b', 'c2', 2000)]
    expect(computeDiscount(row({value: 50}), lines, eur)).toEqual({discountMinor: 1500})
  })
  it('is not applicable when nothing is eligible', () => {
    expect(computeDiscount(row({productIds: ['x']}), [line('a', 'c', 1000)], eur)).toEqual({
      reason: 'not_applicable'
    })
  })
  it('caps so the total keeps the Stripe minimum', () => {
    const lines = [line('a', 'c', 300)]
    expect(computeDiscount(row({value: 50}), lines, eur)).toEqual({discountMinor: 150})
    expect(computeDiscount(row({value: 90}), lines, eur)).toEqual({discountMinor: 250})
    expect(computeDiscount(row({value: 90}), [line('a', 'c', 50)], eur)).toEqual({
      reason: 'not_applicable'
    })
  })
  it('uses the PLN minimum', () => {
    expect(computeDiscount(row({value: 100}), [line('a', 'c', 1000)], 'PLN')).toEqual({
      discountMinor: 800
    })
  })
})

describe('checkAvailable', () => {
  it('rejects null, deleted and inactive as not_found', () => {
    expect(checkAvailable(null, now)).toBe('not_found')
    expect(checkAvailable(row({deletedAt: now}), now)).toBe('not_found')
    expect(checkAvailable(row({isActive: false}), now)).toBe('not_found')
  })
  it('handles window boundaries', () => {
    expect(checkAvailable(row({startsAt: now}), now)).toBeNull()
    expect(checkAvailable(row({startsAt: new Date(now.getTime() + 1)}), now)).toBe('not_started')
    expect(checkAvailable(row({endsAt: now}), now)).toBe('expired')
    expect(checkAvailable(row({endsAt: new Date(now.getTime() + 1)}), now)).toBeNull()
  })
  it('detects used_up', () => {
    expect(checkAvailable(row({maxUses: 3, usedCount: 3}), now)).toBe('used_up')
    expect(checkAvailable(row({maxUses: 3, usedCount: 2}), now)).toBeNull()
    expect(checkAvailable(row({maxUses: null, usedCount: 999}), now)).toBeNull()
  })
})

describe('promoStatus', () => {
  it('maps each status', () => {
    expect(promoStatus(row({isActive: false}), now)).toBe('disabled')
    expect(promoStatus(row({startsAt: new Date(now.getTime() + 1)}), now)).toBe('scheduled')
    expect(promoStatus(row({endsAt: now}), now)).toBe('expired')
    expect(promoStatus(row({maxUses: 1, usedCount: 1}), now)).toBe('used_up')
    expect(promoStatus(row(), now)).toBe('active')
  })
})
