'use client'

import {motion} from 'motion/react'

import type {OrderStatus} from '@shop/shared/orders'

import {STATUS_LABEL, STATUS_TONE, type Tone} from './status-dot'

const STROKE: Record<Tone, string> = {
  ok: 'stroke-ok',
  warn: 'stroke-warn',
  bad: 'stroke-bad',
  idle: 'stroke-idle'
}

/** Share of orders per status as ring segments in the status colours, total in the centre. */
export function StatusDonut({counts}: {counts: {status: OrderStatus; count: number}[]}) {
  const shown = counts.filter(s => s.count > 0)
  const total = shown.reduce((a, s) => a + s.count, 0)
  const r = 16
  const c = 2 * Math.PI * r
  // A small gap between segments keeps neighbours apart without relying on colour alone.
  const gap = shown.length > 1 ? 0.8 : 0
  // Where each segment starts along the ring: the running total of the ones before it.
  const starts = shown.map((_, i) =>
    shown.slice(0, i).reduce((a, s) => a + (s.count / total) * c, 0)
  )
  const label =
    total === 0
      ? 'Orders by status: none'
      : `Orders by status: ${shown.map(s => `${STATUS_LABEL[s.status]} ${String(s.count)}`).join(', ')}`
  return (
    <svg role="img" aria-label={label} viewBox="0 0 40 40" className="size-24 shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" className="stroke-card-raised" />
      {shown.map((s, i) => {
        const len = (s.count / total) * c
        return (
          // Each segment sweeps in from its start, in order round the ring.
          <motion.circle
            key={s.status}
            cx="20"
            cy="20"
            r={r}
            fill="none"
            strokeWidth="5"
            initial={{strokeDasharray: `0 ${String(c)}`}}
            animate={{strokeDasharray: `${String(Math.max(len - gap, 0.1))} ${String(c)}`}}
            transition={{
              duration: 0.6,
              delay: ((starts[i] ?? 0) / c) * 0.4,
              ease: [0.22, 1, 0.36, 1]
            }}
            strokeDashoffset={-(starts[i] ?? 0)}
            transform="rotate(-90 20 20)"
            className={STROKE[STATUS_TONE[s.status]]}
          />
        )
      })}
      <text x="20" y="22.5" textAnchor="middle" className="fill-fg text-[9px] font-semibold">
        {total}
      </text>
    </svg>
  )
}
