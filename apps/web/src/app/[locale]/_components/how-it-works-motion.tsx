'use client'

import {EASE, REVEAL_VIEWPORT} from '@/config/motion'
import {MotionConfig, motion, useReducedMotion} from 'motion/react'
import type {Variants} from 'motion/react'
import type {ReactNode} from 'react'

// Side by side, the steps start half a second apart so the trace walks across; stacked on mobile each plays on its own scroll, with no gap.
const STEP_GAP = 0.55

const stepVariants: Variants = {
  hidden: {},
  shown: (i: number) => ({
    transition: {
      delayChildren: window.matchMedia('(min-width: 768px)').matches ? i * STEP_GAP : 0,
      staggerChildren: 0.1
    }
  })
}

const riseVariants: Variants = {
  hidden: {y: '140%'},
  shown: {y: 0, transition: {duration: 0.7, ease: EASE}}
}

const fadeVariants: Variants = {
  hidden: {opacity: 0, y: 10},
  shown: {opacity: 1, y: 0, transition: {duration: 0.5, ease: EASE}}
}

/** Client boundary for the section's entrance; the copy inside stays server-rendered. Reduced motion keeps the fades and drops the movement. */
export function HowMotion({children}: {children: ReactNode}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

export function HowHeading({
  id,
  className,
  children
}: {
  id: string
  className: string
  children: ReactNode
}) {
  return (
    <motion.h2
      id={id}
      className={className}
      initial={{opacity: 0, y: 16}}
      whileInView={{opacity: 1, y: 0}}
      viewport={REVEAL_VIEWPORT}
      transition={{duration: 0.6, ease: EASE}}>
      {children}
    </motion.h2>
  )
}

/** One cell of the strip: a carrier for the sequence below, which plays when the cell scrolls into view. */
export function HowStep({
  index,
  className,
  children
}: {
  index: number
  className: string
  children: ReactNode
}) {
  return (
    <motion.li
      className={className}
      custom={index}
      variants={stepVariants}
      initial="hidden"
      whileInView="shown"
      viewport={REVEAL_VIEWPORT}>
      <HowTrace />
      {children}
    </motion.li>
  )
}

/** An accent line draws along the cell's top edge and fades, so the three cells read as one track being walked. */
function HowTrace() {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <motion.span
      aria-hidden
      className="absolute inset-x-0 top-0 h-px origin-left bg-accent"
      variants={{
        hidden: {scaleX: 0, opacity: 1},
        shown: {
          scaleX: 1,
          opacity: [1, 1, 0],
          transition: {
            scaleX: {duration: 0.9, ease: EASE},
            opacity: {duration: 1.6, times: [0, 0.55, 1]}
          }
        }
      }}
    />
  )
}

/** The big word rises out from behind a mask; the bottom padding keeps descenders from being clipped. */
export function HowWord({className, children}: {className: string; children: ReactNode}) {
  return (
    // The padding is in em, so the mask needs the word's font size for it to scale with the word.
    <span
      className={`-mx-[0.15em] -mt-[0.15em] -mb-[0.35em] overflow-hidden px-[0.15em] pt-[0.15em] pb-[0.35em] ${className}`}>
      <motion.span className={`block ${className}`} variants={riseVariants}>
        {children}
      </motion.span>
    </span>
  )
}

export function HowFade({className, children}: {className?: string; children: ReactNode}) {
  return (
    <motion.span className={className} variants={fadeVariants}>
      {children}
    </motion.span>
  )
}

export function HowBody({className, children}: {className: string; children: ReactNode}) {
  return (
    <motion.p className={className} variants={fadeVariants}>
      {children}
    </motion.p>
  )
}
