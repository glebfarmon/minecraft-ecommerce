'use client'

import {Donut} from '@/components/donut'
import {useFormat} from '@/hooks/use-format'
import {useTranslations} from 'next-intl'

import type {OrderStats} from '@shop/shared/orders'

// Data colours, not status colours: they must not read as ok/warn/bad.
const STROKE = {EUR: 'stroke-accent', PLN: 'stroke-fg'} as const
const SWATCH = {EUR: 'bg-accent', PLN: 'bg-fg'} as const

/** Paid orders by the currency they were paid in, with the sum in that original currency. */
export function CurrencyDonut({byCurrency}: {byCurrency: OrderStats['byCurrency']}) {
  const t = useTranslations('dashboard')
  const f = useFormat()
  const total = byCurrency.reduce((a, r) => a + r.count, 0)
  const rows = byCurrency.map(r => ({...r, percent: Math.round((r.count / total) * 100)}))
  const label = t('paidByCurrencyLabel', {
    list: rows.map(r => `${r.currency} ${String(r.count)} (${String(r.percent)}%)`).join(', ')
  })
  return (
    <div className="flex flex-wrap items-center gap-6">
      <Donut
        label={label}
        segments={rows.map(r => ({
          key: r.currency,
          value: r.count,
          className: STROKE[r.currency]
        }))}
        centre={
          <text x="20" y="22.5" textAnchor="middle" className="fill-fg text-[9px] font-semibold">
            {total}
          </text>
        }
      />
      <ul className="flex flex-col gap-2">
        {rows.map(r => (
          <li key={r.currency} className="flex items-center gap-3">
            <span aria-hidden className={`size-2 rounded-full ${SWATCH[r.currency]}`} />
            <span className="tabular text-[13px]">
              {t('currencyRow', {
                currency: r.currency,
                percent: r.percent,
                orders: t('ordersCount', {count: r.count}),
                money: f.money(r.totalMinor, r.currency)
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
