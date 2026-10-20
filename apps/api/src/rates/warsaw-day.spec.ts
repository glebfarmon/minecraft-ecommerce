import {addDays, warsawDay} from './warsaw-day'

describe('warsawDay', () => {
  it('uses the Warsaw calendar day, not UTC', () => {
    expect(warsawDay(new Date('2026-10-18T22:30:00Z'))).toBe('2026-10-19')
    expect(warsawDay(new Date('2026-10-18T21:30:00Z'))).toBe('2026-10-18')
  })
  it('follows summer and winter time', () => {
    expect(warsawDay(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15')
    expect(warsawDay(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15')
  })
})

describe('addDays', () => {
  it('moves a YYYY-MM-DD day across month and year edges', () => {
    expect(addDays('2026-10-19', -10)).toBe('2026-10-09')
    expect(addDays('2026-01-03', -10)).toBe('2025-12-24')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})
