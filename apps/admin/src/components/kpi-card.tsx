'use client'

import {useCountUp} from '@/hooks/use-count-up'
import {formatDelta} from '@/lib/format'
import {useTranslations} from 'next-intl'
import {useId} from 'react'

import {cn} from '@shop/ui/lib/utils'

import {Skeleton} from './skeleton'
import {Spark} from './spark'

export function KpiCard({
  label,
  value,
  delta,
  hint,
  tone = 'default',
  spark,
  count,
  hero = false,
  loading = false,
  className
}: {
  label: string
  value: string
  delta?: number | null
  hint?: string
  tone?: 'default' | 'accent'
  spark?: number[]
  /** Counts the shown number up to `to`; `value` stays the text screen readers and search get. */
  count?: {to: number; format: (n: number) => string}
  /** The screen's headline number: a larger value and a full-width trend under it. */
  hero?: boolean
  /** The figures are not in yet: the label stays, the value, trend and note are placeholders. */
  loading?: boolean
  className?: string
}) {
  const t = useTranslations('dashboard')
  const id = useId()
  if (loading) {
    const ph = tone === 'accent' ? 'skeleton-on-accent' : undefined
    return (
      <section
        aria-labelledby={id}
        className={cn(
          'flex min-w-0 flex-col gap-3 rounded-card p-5',
          tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-card',
          className
        )}>
        <h2 id={id} className={cn('label-caps', tone === 'accent' && 'text-on-accent/70')}>
          {label}
        </h2>
        <div className={cn('flex gap-3', hero ? 'flex-col' : 'items-end justify-between')}>
          <Skeleton className={cn(ph, hero ? 'h-[42px] w-3/5' : 'h-8 w-1/2')} />
          {spark && !hero && <Skeleton className={cn(ph, 'h-8 w-24 shrink-0')} />}
        </div>
        {(delta !== undefined || hint) && (
          <Skeleton className={cn(ph, 'my-0.5 h-3 w-2/5 rounded-full')} />
        )}
        {spark && hero && <Skeleton className={cn(ph, 'mt-auto h-16')} />}
      </section>
    )
  }
  return (
    <section
      aria-labelledby={id}
      className={cn(
        // A container, so the value sizes itself to the card instead of being cut off.
        '@container flex min-w-0 flex-col gap-3 rounded-card p-5',
        tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-card',
        className
      )}>
      <h2 id={id} className={cn('label-caps', tone === 'accent' && 'text-on-accent/70')}>
        {label}
      </h2>
      <div className={cn('flex gap-3', hero ? 'flex-col' : 'items-end justify-between')}>
        <p
          className={cn(
            'tabular min-w-0 truncate leading-none font-semibold tracking-[-0.02em]',
            hero ? 'text-[clamp(32px,11cqi,52px)]' : 'text-[clamp(22px,13cqi,32px)]'
          )}>
          {count ? <CountUp value={value} {...count} /> : value}
        </p>
        {spark && !hero && (
          <Spark
            values={spark}
            label={t('perDay', {label})}
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
      {spark && hero && (
        <Spark
          values={spark}
          label={t('perDay', {label})}
          className={cn(
            'mt-auto h-16 w-full',
            tone === 'accent' ? 'text-on-accent' : 'text-accent'
          )}
        />
      )}
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
