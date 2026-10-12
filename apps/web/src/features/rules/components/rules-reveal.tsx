'use client'

import {EASE} from '@/config/motion'
import {MotionConfig, motion} from 'motion/react'
import type {ReactNode} from 'react'

/**
 * Fades a block of the rules page up into place when the page opens. `intro={false}` renders it in
 * place, for blocks that mount later (a section coming back after a search). Reduced motion keeps
 * the fade and drops the movement.
 */
export function RulesReveal({
  delay,
  intro = true,
  className,
  children
}: {
  delay: number
  intro?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial={intro ? {opacity: 0, y: 16} : false}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.6, ease: EASE, delay}}>
        {children}
      </motion.div>
    </MotionConfig>
  )
}
