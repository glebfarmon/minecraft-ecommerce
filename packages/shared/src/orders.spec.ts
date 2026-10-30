import * as v from 'valibot'

import {
  CreateOrderRequestSchema,
  ORDER_MAX_LINES,
  OrderStatsQuerySchema,
  OrderStatsSchema,
  PublicOrderSchema
} from './orders'

const valid = {
  lines: [{server: 'survival', slug: 'vip', quantity: 1}],
  currency: 'EUR',
  locale: 'en',
  nick: 'Steve_1',
  email: 'steve@example.com',
  deliveryConsent: true,
  termsAccepted: true,
  turnstileToken: 'token'
}

describe('CreateOrderRequestSchema', () => {
  it('accepts a valid order', () => {
    expect(v.safeParse(CreateOrderRequestSchema, valid).success).toBe(true)
  })
  it.each([
    ['nick too short', {nick: 'ab'}],
    ['nick with a space', {nick: 'Ste ve'}],
    ['bad email', {email: 'nope'}],
    ['no consent', {deliveryConsent: false}],
    ['terms not accepted', {termsAccepted: false}],
    ['empty cart', {lines: []}],
    ['quantity 0', {lines: [{server: 'survival', slug: 'vip', quantity: 0}]}],
    ['quantity 100', {lines: [{server: 'survival', slug: 'vip', quantity: 100}]}],
    ['bad slug', {lines: [{server: 'Survival!', slug: 'vip', quantity: 1}]}],
    ['unknown currency', {currency: 'USD'}],
    ['empty turnstile token', {turnstileToken: ''}],
    ['client-sent price', {unitAmountMinor: 1}]
  ])('rejects %s', (_name, patch) => {
    expect(v.safeParse(CreateOrderRequestSchema, {...valid, ...patch}).success).toBe(false)
  })
  it('takes an optional promo code', () => {
    expect(v.safeParse(CreateOrderRequestSchema, {...valid, promoCode: ' asf14 '}).success).toBe(
      true
    )
    expect(v.parse(CreateOrderRequestSchema, {...valid, promoCode: ' asf14 '}).promoCode).toBe(
      'ASF14'
    )
  })
  it('rejects more than ORDER_MAX_LINES lines', () => {
    const lines = Array.from({length: ORDER_MAX_LINES + 1}, (_, i) => ({
      server: 'survival',
      slug: `p-${String(i)}`,
      quantity: 1
    }))
    expect(v.safeParse(CreateOrderRequestSchema, {...valid, lines}).success).toBe(false)
  })
  it('rejects the same product twice', () => {
    const line = {server: 'survival', slug: 'vip', quantity: 1}
    expect(v.safeParse(CreateOrderRequestSchema, {...valid, lines: [line, line]}).success).toBe(
      false
    )
  })
})

describe('PublicOrderSchema', () => {
  it('parses a paid order', () => {
    const order = {
      publicId: 'a'.repeat(22),
      status: 'PAID',
      nick: 'Steve_1',
      email: 's***@example.com',
      currency: 'EUR',
      subtotalMinor: 499,
      discountMinor: 0,
      promoCode: null,
      totalMinor: 499,
      servers: [
        {serverName: 'Survival', items: [{productName: 'VIP', quantity: 1, unitAmountMinor: 499}]}
      ],
      createdAt: '2026-10-16T10:00:00.000Z',
      paidAt: '2026-10-16T10:01:00.000Z'
    }
    expect(v.parse(PublicOrderSchema, order)).toEqual(order)
    const without: Record<string, unknown> = {...order}
    delete without.discountMinor
    expect(v.safeParse(PublicOrderSchema, without).success).toBe(false)
  })
})

describe('OrderStatsQuerySchema', () => {
  it('defaults to 7d in EUR', () => {
    expect(v.parse(OrderStatsQuerySchema, {})).toEqual({range: '7d', currency: 'EUR'})
  })
  it('accepts PLN and rejects other currencies', () => {
    expect(v.parse(OrderStatsQuerySchema, {currency: 'PLN'}).currency).toBe('PLN')
    expect(v.safeParse(OrderStatsQuerySchema, {currency: 'USD'}).success).toBe(false)
  })
})

describe('OrderStatsSchema', () => {
  const stats = {
    range: '7d',
    currency: 'EUR',
    from: '2026-10-13T00:00:00.000Z',
    to: '2026-10-19T12:00:00.000Z',
    revenueMinor: 2000,
    previousRevenueMinor: 0,
    paidCount: 2,
    previousPaidCount: 0,
    averageMinor: 1000,
    ltvMinor: 2000,
    buyers: 1,
    awaitingRate: 0,
    previousAwaitingRate: 0,
    expiredCount: 0,
    conversion: 1,
    byStatus: [{status: 'PAID', count: 2}],
    byCurrency: [{currency: 'EUR', count: 2, totalMinor: 2000}],
    daily: [{day: '2026-10-19', totalMinor: 2000, paidCount: 2}],
    topProducts: []
  }
  it('accepts the converted shape, nulls included', () => {
    expect(v.safeParse(OrderStatsSchema, stats).success).toBe(true)
    expect(
      v.safeParse(OrderStatsSchema, {...stats, averageMinor: null, ltvMinor: null}).success
    ).toBe(true)
  })
  it('rejects a missing previousAwaitingRate', () => {
    const rest: Partial<typeof stats> = {...stats}
    delete rest.previousAwaitingRate
    expect(v.safeParse(OrderStatsSchema, rest).success).toBe(false)
  })
  it('rejects a missing currency', () => {
    const rest: Partial<typeof stats> = {...stats}
    delete rest.currency
    expect(v.safeParse(OrderStatsSchema, rest).success).toBe(false)
  })
})
