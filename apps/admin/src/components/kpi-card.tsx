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
  spark
}: {
  label: string
  value: string
  delta?: number | null
  hint?: string
  tone?: 'default' | 'accent'
  spark?: number[]
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
          {value}
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
