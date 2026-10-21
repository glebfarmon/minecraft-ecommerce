'use client'

import {motion} from 'motion/react'
import type {ReactNode} from 'react'

/**
 * The desktop rail, fixed beside the page. Motion treats a fixed `layoutScroll` element as a
 * scroll root, so the pills inside it are measured against the viewport: when a navigation moves
 * the page's scroll (a shorter page clamps it, or the scroll resets), they do not fly in from
 * where the page used to be. A sticky rail cannot do this; Motion only exempts fixed elements.
 */
export function Rail({children}: {children: ReactNode}) {
  return (
    <>
      {/* Holds the rail's column in the grid. */}
      <div aria-hidden className="hidden w-[72px] md:block" />
      <motion.aside
        layoutScroll
        className="fixed top-4 bottom-4 left-4 z-30 hidden w-[72px] flex-col items-center gap-2 rounded-full bg-surface py-4 md:flex">
        {children}
      </motion.aside>
    </>
  )
}
