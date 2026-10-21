import {useDelayedFlag} from '@/hooks/use-delayed-flag'
import {useTranslations} from 'next-intl'

import {cn} from '@shop/ui/lib/utils'

export function Skeleton({className}: {className?: string}) {
  return <div aria-hidden className={cn('skeleton rounded-plate', className)} />
}

/**
 * The status text is there from the first render for screen readers; the blocks wait for the show delay
 * so a load that finishes quickly never flashes a placeholder.
 */
export function SkeletonStatus({
  label,
  className,
  style,
  children
}: {
  label: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const visible = useDelayedFlag(true)
  return (
    <div role="status" className={className} style={style}>
      <span className="sr-only">{label}</span>
      {visible ? children : null}
    </div>
  )
}

export function SkeletonRows({rows = 5}: {rows?: number}) {
  const t = useTranslations('common')
  return (
    <SkeletonStatus
      label={t('loading')}
      className="flex flex-col gap-2"
      style={{minHeight: rows * 48 + (rows - 1) * 8}}>
      {Array.from({length: rows}, (_, i) => (
        <div
          key={i}
          className="skeleton flex h-12 items-center gap-4 rounded-plate px-4"
          aria-hidden>
          <span className="h-3 w-3/5 rounded-full bg-white/[0.06]" />
          <span className="ml-auto h-3 w-1/5 rounded-full bg-white/[0.06]" />
        </div>
      ))}
    </SkeletonStatus>
  )
}
