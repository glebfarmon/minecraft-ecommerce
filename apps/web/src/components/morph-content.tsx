'use client'

import {motion} from 'motion/react'
import type {ReactNode} from 'react'

/**
 * Content of a box that is itself mid-morph: it waits for the box to get going, then blurs in; on
 * the way out it leaves first. Spread onto a `motion` element, so a shared element (a plate) can
 * stay outside the fade while its siblings use it.
 */
export const MORPH_FADE = {
  initial: {opacity: 0, filter: 'blur(6px)'},
  animate: {opacity: 1, filter: 'blur(0px)', transition: {delay: 0.12, duration: 0.25}},
  exit: {opacity: 0, filter: 'blur(6px)', transition: {duration: 0.1}}
}

export function MorphContent({children}: {children: ReactNode}) {
  return <motion.div {...MORPH_FADE}>{children}</motion.div>
}
