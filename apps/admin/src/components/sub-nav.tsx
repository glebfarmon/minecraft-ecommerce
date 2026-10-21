'use client'

import {usePendingHref} from '@/hooks/use-pending-href'
import {LayoutGroup} from 'motion/react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {cn} from '@shop/ui/lib/utils'
import {PILL_FOCUS} from '@shop/ui/pill-focus'

import {RollingIndicator} from './rolling-indicator'

type Item = {href: string; label: string}

/** The longest item href the path sits under, so `/catalog/categories` is not also `/catalog`. */
function matching(items: Item[], pathname: string) {
  return items
    .filter(i => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}

/**
 * Section pills that live in a layout, so they stay mounted across navigation. A click marks its
 * pill at once (the page may take a moment); the path takes over again when it changes.
 */
export function SubNav({label, items}: {label: string; items: Item[]}) {
  const pathname = usePathname()
  const {pending, mark} = usePendingHref(pathname)
  const current = pending ?? matching(items, pathname)

  return (
    <LayoutGroup id={`sub-nav-${label}`}>
      <nav aria-label={label} className="flex w-fit gap-1 rounded-full bg-surface p-1">
        {items.map(i => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={i.href === current ? 'page' : undefined}
            onClick={mark(i.href)}
            className={cn(
              'relative isolate inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-muted transition-colors hover:text-fg aria-[current=page]:text-fg',
              PILL_FOCUS
            )}>
            {i.href === current && <RollingIndicator className="rounded-full bg-card-raised" />}
            {i.label}
          </Link>
        ))}
      </nav>
    </LayoutGroup>
  )
}
