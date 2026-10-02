'use client'

import {useEffect} from 'react'

let locks = 0

/** Freezes page scroll while any modal is open; the counter keeps a closing nested modal from unlocking the page. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    if (locks++ === 0) {
      const gap = window.innerWidth - root.clientWidth
      root.style.overflow = 'hidden'
      root.style.paddingRight = gap > 0 ? String(gap) + 'px' : ''
    }
    return () => {
      if (--locks === 0) {
        root.style.overflow = ''
        root.style.paddingRight = ''
      }
    }
  }, [active])
}
