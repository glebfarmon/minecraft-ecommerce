import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import type * as React from 'react'

import {cn} from './lib/utils'

function Checkbox({className, ...props}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'size-4 shrink-0 rounded-[5px] border border-border bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=checked]:text-on-accent',
        className
      )}
      {...props}>
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-xs leading-none">
        ✓
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export {Checkbox}
