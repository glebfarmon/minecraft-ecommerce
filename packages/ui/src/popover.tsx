'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'

import {cn} from './lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

/** A panel that unfolds out of its trigger (`.popover-content` in the app's CSS). */
function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'popover-content rounded-plate bg-card-raised z-50 p-3 shadow-lg shadow-black/40 outline-none',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export {Popover, PopoverContent, PopoverTrigger}
