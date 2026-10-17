export const formatTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
export const formatMoney = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat('en', {style: 'currency', currency}).format(amountMinor / 100)
export const formatPercent = (fraction: number | null) =>
  fraction === null ? '—' : `${String(Math.round(fraction * 100))}%`
export const formatDelta = (fraction: number) => {
  const pct = Math.round(fraction * 100)
  if (pct === 0) return '0%'
  return `${pct > 0 ? '+' : '−'}${String(Math.abs(pct))}%`
}
/** Change from previous to current as a fraction; null when there is no base to compare with. */
export const delta = (current: number, previous: number) =>
  previous === 0 ? null : (current - previous) / previous
