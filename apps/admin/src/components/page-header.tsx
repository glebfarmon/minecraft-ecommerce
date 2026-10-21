import {ArrowLeft} from 'lucide-react'
import Link from 'next/link'
import type {ReactNode} from 'react'

import {Button} from '@shop/ui/button'

export function PageHeader({
  title,
  description,
  actions,
  back
}: {
  title: ReactNode
  description?: string
  actions?: ReactNode
  /** A link to the parent list, shown above the title on the left. */
  back?: {href: string; label: string}
}) {
  return (
    <header className="flex flex-col gap-2">
      {back && (
        <Button asChild variant="ghost" className="-ml-3 self-start">
          <Link href={back.href}>
            <ArrowLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        </Button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]">
            {title}
          </h1>
          {description && <p className="text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}
