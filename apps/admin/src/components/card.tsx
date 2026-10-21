import {type ReactNode, useId} from 'react'

import {cn} from '@shop/ui/lib/utils'

export function Card({
  title,
  action,
  tone = 'default',
  className,
  children
}: {
  title?: ReactNode
  action?: ReactNode
  tone?: 'default' | 'accent'
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-card p-5',
        tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-card',
        className
      )}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && (
            <h2 id={id} className="text-[15px] font-semibold">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
