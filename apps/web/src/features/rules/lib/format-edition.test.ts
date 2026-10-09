import {formatEdition} from './format-edition'

describe('formatEdition', () => {
  it('shows the calendar date in Poland, not in UTC', () => {
    // 00:30 in Warsaw on 28 May is still 27 May in UTC.
    expect(formatEdition('2026-05-27T22:30:00Z', 'pl')).toBe('28 maja 2026')
    expect(formatEdition('2026-05-27T22:30:00Z', 'en')).toBe('May 28, 2026')
  })
})
