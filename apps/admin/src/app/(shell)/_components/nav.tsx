'use client'

import {NAV} from '@/config/nav'
import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {type Me, hasPermission} from '@shop/shared/access'

function isCurrent(pathname: string, base: string) {
  return pathname === base || (base !== '/' && pathname.startsWith(`${base}/`))
}

export function Nav({me}: {me: Me}) {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.filter(item => !item.permission || hasPermission(me.permissions, item.permission)).map(
        item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent(pathname, item.match ?? item.href) ? 'page' : undefined}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-card-raised hover:text-foreground aria-[current=page]:bg-card-raised aria-[current=page]:text-foreground">
            {item.label}
          </Link>
        )
      )}
    </nav>
  )
}
