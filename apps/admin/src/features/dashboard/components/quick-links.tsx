import {NAV} from '@/config/nav'
import {ArrowUpRight} from 'lucide-react'
import Link from 'next/link'

import {type Me, hasPermission} from '@shop/shared/access'

export function QuickLinks({me}: {me: Me}) {
  const items = NAV.filter(
    item =>
      item.href !== '/' && (!item.permission || hasPermission(me.permissions, item.permission))
  )
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(item => {
        const Icon = item.icon
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex items-center gap-4 rounded-card bg-card p-5 transition-colors hover:bg-card-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
              <span className="grid size-11 place-items-center rounded-full bg-card-raised text-muted group-hover:bg-surface">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="flex-1 font-semibold">{item.label}</span>
              <ArrowUpRight aria-hidden className="size-4 text-muted" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
