import {formatPrice} from './catalog'

const NBSP = ' '

describe('formatPrice', () => {
  it('puts the currency after the amount', () => {
    expect(formatPrice(499, 'EUR', 'en')).toBe(`4.99${NBSP}€`)
    expect(formatPrice(2199, 'PLN', 'en')).toBe(`21.99${NBSP}PLN`)
  })

  it('keeps the locale separators and its currency symbol', () => {
    expect(formatPrice(499, 'EUR', 'pl')).toBe(`4,99${NBSP}€`)
    expect(formatPrice(2199, 'PLN', 'pl')).toBe(`21,99${NBSP}zł`)
  })

  it('keeps digit grouping', () => {
    expect(formatPrice(123456789, 'EUR', 'en')).toBe(`1,234,567.89${NBSP}€`)
  })
})
