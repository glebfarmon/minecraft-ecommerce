'use client'

import {useTranslations} from 'next-intl'

import type {OrderStatus} from '@shop/shared/orders'

import {Donut} from './donut'
import {STATUS_TONE, type Tone} from './status-dot'

const STROKE: Record<Tone, string> = {
  ok: 'stroke-ok',
  warn: 'stroke-warn',
  bad: 'stroke-bad',
  idle: 'stroke-idle'
}

/** Share of orders per status as ring segments in the status colours, total in the centre. */
export function StatusDonut({counts}: {counts: {status: OrderStatus; count: number}[]}) {
  const t = useTranslations('status')
  const d = useTranslations('dashboard')
  const shown = counts.filter(s => s.count > 0)
  const total = shown.reduce((a, s) => a + s.count, 0)
  const label =
    total === 0
      ? d('ordersByStatusNone')
      : d('ordersByStatusLabel', {
          list: shown.map(s => `${t(s.status)} ${String(s.count)}`).join(', ')
        })
  return (
    <Donut
      label={label}
      segments={shown.map(s => ({
        key: s.status,
        value: s.count,
        className: STROKE[STATUS_TONE[s.status]]
      }))}
      centre={
        <text x="20" y="22.5" textAnchor="middle" className="fill-fg text-[9px] font-semibold">
          {total}
        </text>
      }
    />
  )
}
