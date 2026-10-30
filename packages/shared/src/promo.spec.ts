import * as v from 'valibot'

import {LoosePromoCodeSchema, PromoCodeInputSchema, PromoCodeSchema} from './promo'

const input = {
  code: 'ASF14',
  kind: 'PERCENT',
  value: 15,
  currency: null,
  maxUses: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  categoryIds: [],
  productIds: []
}

describe('PromoCodeSchema', () => {
  it('trims and upper-cases', () => {
    expect(v.parse(PromoCodeSchema, ' asf14 ')).toBe('ASF14')
  })
  it.each(['AS', 'ASF-14'])('rejects %s', code => {
    expect(v.safeParse(PromoCodeSchema, code).success).toBe(false)
  })
})

describe('LoosePromoCodeSchema', () => {
  it('keeps odd characters', () => {
    expect(v.parse(LoosePromoCodeSchema, 'ASF-14')).toBe('ASF-14')
  })
})

describe('PromoCodeInputSchema', () => {
  it('accepts a percent code', () => {
    expect(v.safeParse(PromoCodeInputSchema, input).success).toBe(true)
  })
  it('accepts a fixed code with currency', () => {
    expect(
      v.safeParse(PromoCodeInputSchema, {...input, kind: 'FIXED', value: 500, currency: 'EUR'})
        .success
    ).toBe(true)
  })
  it.each([
    ['percent 0', {value: 0}],
    ['percent 101', {value: 101}],
    ['percent with currency', {currency: 'EUR'}],
    ['fixed without currency', {kind: 'FIXED', value: 500}],
    ['maxUses 0', {maxUses: 0}],
    [
      'endsAt equal to startsAt',
      {startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z'}
    ],
    [
      'endsAt before startsAt',
      {startsAt: '2026-10-02T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z'}
    ]
  ])('rejects %s', (_name, patch) => {
    expect(v.safeParse(PromoCodeInputSchema, {...input, ...patch}).success).toBe(false)
  })
})

describe('PromoCodeInputSchema bounds', () => {
  const ok = (patch: object) => v.safeParse(PromoCodeInputSchema, {...input, ...patch}).success
  it('caps a fixed amount and maxUses at int32', () => {
    const fixed = {kind: 'FIXED', currency: 'EUR'}
    expect(ok({...fixed, value: 2_147_483_647})).toBe(true)
    expect(ok({...fixed, value: 2_147_483_648})).toBe(false)
    expect(ok({maxUses: 2_147_483_647})).toBe(true)
    expect(ok({maxUses: 2_147_483_648})).toBe(false)
  })
  it('caps the scope lists at 200 ids', () => {
    const ids = (n: number) => Array.from({length: n}, (_, i) => `id${String(i)}`)
    expect(ok({categoryIds: ids(200), productIds: ids(200)})).toBe(true)
    expect(ok({categoryIds: ids(201)})).toBe(false)
    expect(ok({productIds: ids(201)})).toBe(false)
  })
})
