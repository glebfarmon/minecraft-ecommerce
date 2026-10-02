'use client'

import {MotionConfig, motion} from 'motion/react'
import type {Variants} from 'motion/react'
import type {ReactNode} from 'react'

const EASE = [0.16, 1, 0.3, 1] as const
// The footer sits at the very end of the page, so there is no inset: the last row must still count as in view at maximum scroll.
const VIEWPORT = {once: true, amount: 0.2}

const blockVariants: Variants = {
  hidden: {},
  shown: {transition: {staggerChildren: 0.08}}
}

const itemVariants: Variants = {
  hidden: {opacity: 0, y: 12},
  shown: {opacity: 1, y: 0, transition: {duration: 0.6, ease: EASE}}
}

const letterVariants: Variants = {
  hidden: {y: '110%'},
  shown: {y: 0, transition: {duration: 0.8, ease: EASE}}
}

const lineVariants: Variants = {
  hidden: {scaleX: 0},
  shown: {scaleX: 1, transition: {duration: 1, ease: EASE}}
}

/** Client boundary for the footer's entrance; copy and links stay server-rendered. Reduced motion keeps the fades and drops the movement. */
export function FooterMotion({children}: {children: ReactNode}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/** A band of the footer. It plays its children when it scrolls into view, then draws its bottom rule. */
export function FooterBlock({
  className,
  rule = true,
  children
}: {
  className: string
  rule?: boolean
  children: ReactNode
}) {
  return (
    <motion.div
      className={`relative ${className}`}
      variants={blockVariants}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}>
      {children}
      {rule && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px origin-left bg-line"
          variants={lineVariants}
        />
      )}
    </motion.div>
  )
}

export function FooterItem({className, children}: {className?: string; children: ReactNode}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}

export function FooterSpan({className, children}: {className?: string; children: ReactNode}) {
  return (
    <motion.span className={className} variants={itemVariants}>
      {children}
    </motion.span>
  )
}

/** The wordmark: each letter rises out from behind its own mask, left to right; the padding keeps the tight line-height from clipping the glyphs. */
export function FooterWordmark({plain, accent}: {plain: string; accent: string}) {
  const letter = (char: string, i: number, className?: string) => (
    <span
      key={`${className ?? 'p'}-${String(i)}`}
      className="-mt-[0.12em] -mb-[0.2em] inline-block overflow-hidden pt-[0.12em] pb-[0.2em]">
      <motion.span className={`inline-block ${className ?? ''}`} variants={letterVariants}>
        {char}
      </motion.span>
    </span>
  )
  return (
    <motion.p
      aria-hidden
      variants={{hidden: {}, shown: {transition: {staggerChildren: 0.055}}}}
      className="font-display text-[clamp(4.5rem,17vw,16rem)] leading-[0.8] font-bold tracking-[-0.01em] text-fg uppercase">
      {plain.split('').map((c, i) => letter(c, i))}
      {accent.split('').map((c, i) => letter(c, i, 'text-accent'))}
    </motion.p>
  )
}
