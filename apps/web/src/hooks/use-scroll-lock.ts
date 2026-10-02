'use client'

import {useEffect} from 'react'

let locks = 0

/** Freezes page scroll while any modal is open; the counter keeps a closing nested modal from unlocking the page. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    // `scrollbar-gutter: stable` (globals.css) keeps the scrollbar's space, so nothing shifts when it hides.
    if (locks++ === 0) root.style.overflow = 'hidden'
    return () => {
      if (--locks === 0) root.style.overflow = ''
    }
  }, [active])
}
