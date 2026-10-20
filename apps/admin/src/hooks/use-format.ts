'use client'

import {formatDelta, formatMoney, formatPercent, formatTime} from '@/lib/format'
import {useLocale} from 'next-intl'

/** The formatters bound to the language the admin is showing. */
export function useFormat() {
  const locale = useLocale()
  return {
    locale,
    time: (iso: string) => formatTime(iso, locale),
    money: (amountMinor: number, currency: string) => formatMoney(amountMinor, currency, locale),
    percent: formatPercent,
    delta: formatDelta
  }
}
