import {formatDelta, formatMoney, formatPercent, formatTime} from './format'

const plain = (text: string) => text.replaceAll(/\s/g, ' ')

describe('formatTime', () => {
  it('keeps the English form byte-identical', () => {
    expect(formatTime('2026-10-19T14:05:00Z')).toBe('2026-10-19 14:05 UTC')
    expect(formatTime('2026-10-19T14:05:00Z', 'en')).toBe('2026-10-19 14:05 UTC')
  })
  it('writes the Polish date with a short month', () => {
    expect(plain(formatTime('2026-10-19T14:05:00Z', 'pl'))).toBe('19 paź 2026, 14:05 UTC')
  })
})

describe('formatMoney', () => {
  it('keeps the English form unchanged', () => {
    expect(formatMoney(123450, 'EUR', 'en')).toBe('€1,234.50')
    expect(formatMoney(123450, 'EUR')).toBe('€1,234.50')
  })
  it('uses the Polish decimal comma and currency sign', () => {
    expect(plain(formatMoney(123450, 'PLN', 'pl'))).toBe('1234,50 zł')
  })
})

describe('formatPercent and formatDelta', () => {
  it('format a fraction, with a dash for no data', () => {
    expect(formatPercent(0.5)).toBe('50%')
    expect(formatPercent(0.5)).toBe('50%')
    expect(formatPercent(null)).toBe('—')
  })
  it('sign the change with a real minus', () => {
    expect(formatDelta(0.25)).toBe('+25%')
    expect(formatDelta(-0.1)).toBe('−10%')
    expect(formatDelta(0)).toBe('0%')
  })
})
