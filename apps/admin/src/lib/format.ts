import type {AdminLocale} from '@/i18n/locale'

const POLISH_DATE = new Intl.DateTimeFormat('pl', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC'
})

/** English keeps the ISO-like form tests and e2e rely on; Polish reads `19 paź 2026, 14:05 UTC`. */
export const formatTime = (iso: string, locale: AdminLocale = 'en') =>
  locale === 'pl'
    ? `${POLISH_DATE.format(new Date(iso))} UTC`
    : `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
export const formatMoney = (amountMinor: number, currency: string, locale: AdminLocale = 'en') =>
  new Intl.NumberFormat(locale, {style: 'currency', currency}).format(amountMinor / 100)
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
