import type * as React from 'react'

import {cn} from './lib/utils'

function Textarea({className, ...props}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'rounded-plate aria-invalid:border-bad flex min-h-24 w-full border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export {Textarea}
