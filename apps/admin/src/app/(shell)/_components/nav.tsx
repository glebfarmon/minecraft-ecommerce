'use client'

import {Hint} from '@/components/hint'
import {RollingIndicator} from '@/components/rolling-indicator'
import {NAV} from '@/config/nav'
import {LayoutGroup} from 'motion/react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Fragment} from 'react'

import {type Me, hasPermission} from '@shop/shared/access'
import {cn} from '@shop/ui/lib/utils'

function isCurrent(pathname: string, base: string) {
  return pathname === base || (base !== '/' && pathname.startsWith(`${base}/`))
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function Nav({
  me,
  variant,
  onNavigate
}: {
  me: Me
  variant: 'rail' | 'sheet'
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const rail = variant === 'rail'
  return (
    <LayoutGroup id={rail ? 'rail' : 'sheet'}>
      <nav
        aria-label={rail ? 'Admin' : 'Admin menu'}
        className={cn('flex flex-col gap-1', rail && 'items-center gap-2')}>
        {NAV.filter(item => !item.permission || hasPermission(me.permissions, item.permission)).map(
          item => {
            const Icon = item.icon
            const current = isCurrent(pathname, item.match ?? item.href)
            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={current ? 'page' : undefined}
                aria-label={rail ? item.label : undefined}
                className={cn(
                  FOCUS,
                  rail
                    ? 'relative isolate flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-raised'
                    : 'relative isolate flex items-center gap-3 rounded-full px-3 py-2.5 text-sm text-muted transition-colors hover:bg-card-raised',
                  current && 'text-bg hover:bg-transparent'
                )}>
                {current && <RollingIndicator className="rounded-full bg-fg" />}
                <Icon aria-hidden className="size-5 shrink-0" />
                {!rail && item.label}
              </Link>
            )
            return rail ? (
              <Hint key={item.href} label={item.label} side="right">
                {link}
              </Hint>
            ) : (
              <Fragment key={item.href}>{link}</Fragment>
            )
          }
        )}
      </nav>
    </LayoutGroup>
  )
}
