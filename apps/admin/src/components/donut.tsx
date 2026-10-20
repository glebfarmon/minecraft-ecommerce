'use client'

import {motion, useReducedMotion} from 'motion/react'
import type {ReactNode} from 'react'

export interface DonutSegment {
  key: string
  value: number
  /** A Tailwind `stroke-*` class; the colour of the segment. */
  className: string
}

const R = 16
const C = 2 * Math.PI * R

/**
 * Ring segments sized by `value`, with `centre` (SVG content, usually a `<text>`) in the middle.
 * Segments of zero are left out. On mount each one sweeps in from its own start, in order round
 * the ring; with reduced motion the ring is simply there.
 */
export function Donut({
  segments,
  label,
  centre
}: {
  segments: DonutSegment[]
  label: string
  centre: ReactNode
}) {
  const reduce = useReducedMotion()
  const shown = segments.filter(s => s.value > 0)
  const total = shown.reduce((a, s) => a + s.value, 0)
  // A small gap between segments keeps neighbours apart without relying on colour alone.
  const gap = shown.length > 1 ? 0.8 : 0
  // Where each segment starts along the ring: the running total of the ones before it.
  const starts = shown.map((_, i) =>
    shown.slice(0, i).reduce((a, s) => a + (s.value / total) * C, 0)
  )
  return (
    <svg role="img" aria-label={label} viewBox="0 0 40 40" className="size-24 shrink-0">
      <circle cx="20" cy="20" r={R} fill="none" strokeWidth="5" className="stroke-card-raised" />
      {shown.map((s, i) => {
        const dash = `${String(Math.max((s.value / total) * C - gap, 0.1))} ${String(C)}`
        return (
          <motion.circle
            key={s.key}
            cx="20"
            cy="20"
            r={R}
            fill="none"
            strokeWidth="5"
            initial={{strokeDasharray: reduce ? dash : `0 ${String(C)}`}}
            animate={{strokeDasharray: dash}}
            transition={{
              duration: reduce ? 0 : 0.6,
              delay: reduce ? 0 : ((starts[i] ?? 0) / C) * 0.4,
              ease: [0.22, 1, 0.36, 1]
            }}
            strokeDashoffset={-(starts[i] ?? 0)}
            transform="rotate(-90 20 20)"
            className={s.className}
          />
        )
      })}
      {centre}
    </svg>
  )
}
