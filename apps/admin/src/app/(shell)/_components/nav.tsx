'use client'

import {NAV} from '@/config/nav'
import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {type Me, hasPermission} from '@shop/shared/access'

export function Nav({me}: {me: Me}) {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.filter(item => !item.permission || hasPermission(me.permissions, item.permission)).map(
        item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={
              pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))
                ? 'page'
                : undefined
            }
            className="text-muted-foreground rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground">
            {item.label}
          </Link>
        )
      )}
    </nav>
  )
}
