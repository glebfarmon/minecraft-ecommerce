'use client'

import {useCountUp} from '@/hooks/use-count-up'
import {formatDelta} from '@/lib/format'
import {useId} from 'react'

import {cn} from '@shop/ui/lib/utils'

import {Spark} from './spark'

export function KpiCard({
  label,
  value,
  delta,
  hint,
  tone = 'default',
  spark,
  count
}: {
  label: string
  value: string
  delta?: number | null
  hint?: string
  tone?: 'default' | 'accent'
  spark?: number[]
  /** Counts the shown number up to `to`; `value` stays the text screen readers and search get. */
  count?: {to: number; format: (n: number) => string}
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-card p-5',
        tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-card'
      )}>
      <h2 id={id} className={cn('label-caps', tone === 'accent' && 'text-on-accent/70')}>
        {label}
      </h2>
      <div className="flex items-end justify-between gap-3">
        <p className="tabular truncate text-[32px] leading-none font-semibold tracking-[-0.02em]">
          {count ? <CountUp value={value} {...count} /> : value}
        </p>
        {spark && (
          <Spark
            values={spark}
            label={`${label} per day`}
            className={cn(
              'h-8 w-24 shrink-0',
              tone === 'accent' ? 'text-on-accent' : 'text-accent'
            )}
          />
        )}
      </div>
      {(delta !== undefined && delta !== null) || hint ? (
        <p className={cn('text-[12px]', tone === 'accent' ? 'text-on-accent/70' : 'text-muted')}>
          {delta !== undefined && delta !== null && (
            <span
              className={cn(
                'font-semibold',
                tone !== 'accent' && (delta >= 0 ? 'text-ok' : 'text-bad')
              )}>
              {formatDelta(delta)}
            </span>
          )}{' '}
          {hint}
        </p>
      ) : null}
    </section>
  )
}

/**
 * The running number is drawn from `data-count` by CSS, so the DOM text is only the settled value:
 * screen readers hear it once and text queries find it once.
 */
function CountUp({value, to, format}: {value: string; to: number; format: (n: number) => string}) {
  const n = useCountUp(to)
  return (
    <>
      <span className="sr-only">{value}</span>
      <span
        aria-hidden
        data-count={format(Math.round(n))}
        className="after:content-[attr(data-count)]"
      />
    </>
  )
}
