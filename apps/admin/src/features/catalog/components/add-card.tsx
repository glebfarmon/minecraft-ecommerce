import Link from 'next/link'

import {cn} from '@shop/ui/lib/utils'

export function AddCard({
  href,
  label,
  className
}: {
  href: string
  label: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-center rounded-card border border-dashed border-border px-4 text-[13px] font-medium text-muted transition-colors hover:bg-card hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        className
      )}>
      {label}
    </Link>
  )
}
