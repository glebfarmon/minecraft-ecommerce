'use client'

import {Hint} from '@/components/hint'
import {RollingIndicator} from '@/components/rolling-indicator'
import {NAV} from '@/config/nav'
import {usePendingHref} from '@/hooks/use-pending-href'
import {useListAdminDeliveriesQuery} from '@/lib/api/generated'
import {LayoutGroup, motion} from 'motion/react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Fragment} from 'react'

import {type Me, hasPermission} from '@shop/shared/access'
import {cn} from '@shop/ui/lib/utils'
import {PILL_FOCUS} from '@shop/ui/pill-focus'

function isCurrent(pathname: string, base: string) {
  return pathname === base || (base !== '/' && pathname.startsWith(`${base}/`))
}

export function Nav({
  me,
  variant,
  onNavigate
}: {
  me: Me
  variant: 'rail' | 'sheet'
  onNavigate?: () => void
}) {
  const t = useTranslations('nav')
  const shell = useTranslations('shell')
  const pathname = usePathname()
  // The path changes only once the next page is ready; the clicked item is current at once.
  const {pending, mark} = usePendingHref(pathname)
  const rail = variant === 'rail'
  // The first page of the list is what the deliveries page shows, so the cache is shared.
  const attention =
    useListAdminDeliveriesQuery(
      {cursor: undefined},
      {skip: !hasPermission(me.permissions, 'order.read')}
    ).data?.attentionCount ?? 0
  return (
    <LayoutGroup id={rail ? 'rail' : 'sheet'}>
      {/* As a layout root, Motion measures the pill against the nav; the rail's own scroll root
          (`Rail`) keeps a navigation's scroll change from flying it in. */}
      <motion.nav
        layout
        layoutRoot
        aria-label={rail ? shell('admin') : shell('adminMenu')}
        className={cn('flex flex-col gap-1', rail && 'items-center gap-2')}>
        {NAV.filter(item => !item.permission || hasPermission(me.permissions, item.permission)).map(
          item => {
            const Icon = item.icon
            const label = t(item.key)
            const badge = item.key === 'deliveries' ? attention : 0
            const current = pending
              ? pending === item.href
              : isCurrent(pathname, item.match ?? item.href)
            const link = (
              <Link
                href={item.href}
                onClick={e => {
                  mark(item.href)(e)
                  onNavigate?.()
                }}
                aria-current={current ? 'page' : undefined}
                aria-label={
                  badge > 0 ? t('attention', {label, count: badge}) : rail ? label : undefined
                }
                className={cn(
                  PILL_FOCUS,
                  rail
                    ? 'relative isolate flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-raised'
                    : 'relative isolate flex items-center gap-3 rounded-full px-3 py-2.5 text-sm text-muted transition-colors hover:bg-card-raised',
                  current && 'text-bg hover:bg-transparent'
                )}>
                {current && <RollingIndicator className="rounded-full bg-fg" />}
                <Icon aria-hidden className="size-5 shrink-0" />
                {!rail && label}
                {badge > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'tabular rounded-full bg-bad px-1.5 text-[11px] leading-4 font-medium text-bg',
                      rail ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'
                    )}>
                    {badge}
                  </span>
                )}
              </Link>
            )
            return rail ? (
              <Hint key={item.href} label={label} side="right">
                {link}
              </Hint>
            ) : (
              <Fragment key={item.href}>{link}</Fragment>
            )
          }
        )}
      </motion.nav>
    </LayoutGroup>
  )
}
