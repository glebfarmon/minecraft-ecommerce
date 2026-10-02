'use client'

import {Plus} from 'lucide-react'
import {AnimatePresence, MotionConfig, motion, useReducedMotion} from 'motion/react'
import type {Variants} from 'motion/react'
import {useId, useState} from 'react'
import type {ReactNode} from 'react'

const EASE = [0.16, 1, 0.3, 1] as const
const VIEWPORT = {once: true, margin: '0px 0px -15% 0px'}

const listVariants: Variants = {
  hidden: {},
  shown: {transition: {staggerChildren: 0.09}}
}

const lineVariants: Variants = {
  hidden: {scaleX: 0},
  shown: {scaleX: 1, transition: {duration: 0.9, ease: EASE}}
}

const questionVariants: Variants = {
  hidden: {opacity: 0, y: 14},
  shown: {opacity: 1, y: 0, transition: {duration: 0.6, ease: EASE}}
}

/** Client boundary for the section's motion; the copy stays server-rendered. Reduced motion keeps fades and drops movement. */
export function FaqMotion({children}: {children: ReactNode}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

export function FaqHeading({
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
      viewport={VIEWPORT}
      transition={{duration: 0.6, ease: EASE}}>
      {children}
    </motion.h2>
  )
}

/** Carrier for the rows: they enter one after another when the list scrolls into view. */
export function FaqList({className, children}: {className: string; children: ReactNode}) {
  return (
    <motion.div
      className={className}
      variants={listVariants}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}>
      {children}
    </motion.div>
  )
}

/**
 * One question. The answer unfolds by height while its text rises and sharpens a beat behind;
 * closing is quicker than opening and drops the text first.
 */
export function FaqItem({question, children}: {question: string; children: ReactNode}) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const panelId = useId()

  return (
    <motion.div className="relative" variants={questionVariants}>
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px origin-left bg-line"
        variants={lineVariants}
      />
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(v => !v)
          }}
          className="group flex w-full cursor-pointer items-center justify-between gap-6 rounded-xl py-6 text-left text-lg font-medium tracking-[-0.01em] transition-colors duration-300 hover:text-accent">
          {question}
          <Plus
            aria-hidden
            className={`size-5 shrink-0 transition-[transform,color] duration-500 ease-out-expo ${
              open ? 'rotate-45 text-accent' : 'text-muted group-hover:text-accent'
            }`}
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-label={question}
            className="overflow-hidden"
            initial={{height: 0, opacity: 0}}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {duration: reduce ? 0.15 : 0.55, ease: EASE}
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {duration: reduce ? 0.1 : 0.3, ease: [0.4, 0, 0.2, 1]}
            }}>
            <motion.div
              initial={{y: 10, filter: 'blur(4px)'}}
              animate={{
                y: 0,
                filter: 'blur(0px)',
                transition: {duration: 0.6, ease: EASE, delay: 0.08}
              }}
              exit={{y: 0, filter: 'blur(0px)', transition: {duration: 0}}}
              className="max-w-[62ch] pb-6 leading-relaxed text-fg/75">
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
