import type * as React from 'react'

import {cn} from './lib/utils'

/** A styled native select: keyboard, screen-reader and mobile behaviour come from the browser. */
function Select({className, ...props}: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'rounded-plate aria-invalid:border-bad flex h-9 min-w-0 border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export {Select}
