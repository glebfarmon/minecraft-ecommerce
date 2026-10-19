'use client'

import {NAV} from '@/config/nav'
import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {type Me, hasPermission} from '@shop/shared/access'
import {cn} from '@shop/ui/lib/utils'

function isCurrent(pathname: string, base: string) {
  return pathname === base || (base !== '/' && pathname.startsWith(`${base}/`))
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]'

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
    <nav
      aria-label={rail ? 'Admin' : 'Admin menu'}
      className={cn('flex flex-col gap-1', rail && 'items-center gap-2')}>
      {NAV.filter(item => !item.permission || hasPermission(me.permissions, item.permission)).map(
        item => {
          const Icon = item.icon
          const current = isCurrent(pathname, item.match ?? item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? 'page' : undefined}
              aria-label={rail ? item.label : undefined}
              title={rail ? item.label : undefined}
              className={cn(
                FOCUS,
                rail
                  ? 'flex size-11 items-center justify-center rounded-full text-muted hover:bg-card-raised'
                  : 'flex items-center gap-3 rounded-full px-3 py-2.5 text-sm text-muted hover:bg-card-raised',
                current && 'bg-fg text-bg hover:bg-fg'
              )}>
              <Icon aria-hidden className="size-5 shrink-0" />
              {!rail && item.label}
            </Link>
          )
        }
      )}
    </nav>
  )
}
