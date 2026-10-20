import {useTranslations} from 'next-intl'

import {cn} from '@shop/ui/lib/utils'

export function Skeleton({className}: {className?: string}) {
  return <div aria-hidden className={cn('animate-pulse rounded-plate bg-card-raised', className)} />
}

export function SkeletonRows({rows = 5}: {rows?: number}) {
  const t = useTranslations('common')
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">{t('loading')}</span>
      {Array.from({length: rows}, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  )
}
