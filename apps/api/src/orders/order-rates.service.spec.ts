import {convertTotals} from './order-rates.service'

describe('convertTotals', () => {
  it('converts an EUR order to PLN, half-up', () => {
    expect(convertTotals(1000, 'EUR', '4.2875')).toEqual({totalEurMinor: 1000, totalPlnMinor: 4288})
  })
  it('converts a PLN order to EUR', () => {
    expect(convertTotals(4300, 'PLN', '4.3000')).toEqual({totalEurMinor: 1000, totalPlnMinor: 4300})
  })
  it('rounds half up, not to even', () => {
    // 5 / 4 = 1.25 → 1; 6 / 4 = 1.5 → 2; 10 × 0.5 style ties round away from zero
    expect(convertTotals(6, 'PLN', '4.0000').totalEurMinor).toBe(2)
    expect(convertTotals(2, 'EUR', '2.2500').totalPlnMinor).toBe(5)
  })
  it('turns a tiny PLN total into zero EUR cents', () => {
    expect(convertTotals(1, 'PLN', '4.3000').totalEurMinor).toBe(0)
  })
})
