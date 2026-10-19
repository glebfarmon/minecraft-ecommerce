'use client'

import {motion} from 'motion/react'

import {cn} from '@shop/ui/lib/utils'

/**
 * The pill that rolls to the chosen item. Render it inside the active item only (which needs
 * `relative isolate`), within a `LayoutGroup` that names the set it rolls across.
 */
export function RollingIndicator({className}: {className?: string}) {
  return (
    <motion.span
      data-slot="rolling-indicator"
      layoutId="rolling-indicator"
      aria-hidden
      className={cn('absolute inset-0 -z-10', className)}
      transition={{type: 'spring', bounce: 0, duration: 0.35}}
    />
  )
}
