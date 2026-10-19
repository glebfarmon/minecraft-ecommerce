import type * as React from 'react'

import {cn} from './lib/utils'

function Input({className, type, ...props}: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'rounded-plate aria-invalid:border-bad flex h-9 w-full min-w-0 border border-border bg-surface px-3 text-sm text-fg transition-colors placeholder:text-muted read-only:opacity-70 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export {Input}
