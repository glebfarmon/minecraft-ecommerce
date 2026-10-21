'use client'

import {type MotionStyle, motion} from 'motion/react'

import {cn} from '@shop/ui/lib/utils'

/**
 * The pill that rolls to the chosen item. Render it inside the active item only (which needs
 * `relative isolate`), within a `LayoutGroup` that names the set it rolls across.
 */
export function RollingIndicator({
  className,
  style
}: {
  className?: string
  /** Set `borderRadius` here, not in a class, so Motion corrects it during the layout animation. */
  style?: MotionStyle
}) {
  return (
    <motion.span
      data-slot="rolling-indicator"
      layoutId="rolling-indicator"
      aria-hidden
      className={cn('absolute inset-0 -z-10', className)}
      style={style}
      transition={{type: 'spring', bounce: 0, duration: 0.35}}
    />
  )
}
