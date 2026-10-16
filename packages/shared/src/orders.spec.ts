import * as v from 'valibot'

import {CreateOrderRequestSchema, ORDER_MAX_LINES, PublicOrderSchema} from './orders'

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
      totalMinor: 499,
      servers: [
        {serverName: 'Survival', items: [{productName: 'VIP', quantity: 1, unitAmountMinor: 499}]}
      ],
      createdAt: '2026-10-16T10:00:00.000Z',
      paidAt: '2026-10-16T10:01:00.000Z'
    }
    expect(v.parse(PublicOrderSchema, order)).toEqual(order)
  })
})
