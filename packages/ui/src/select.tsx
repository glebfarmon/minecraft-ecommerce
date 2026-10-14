import type * as React from 'react'

import {cn} from './lib/utils'

/** A styled native select: keyboard, screen-reader and mobile behaviour come from the browser. */
function Select({className, ...props}: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'border-input bg-background flex h-9 min-w-0 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export {Select}
