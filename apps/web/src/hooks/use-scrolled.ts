'use client'

import {useLayoutEffect, useState} from 'react'

// Two thresholds so a trackpad resting near one of them does not toggle the state back and forth.
const ON_ABOVE = 8
const OFF_AT_OR_BELOW = 2

/** True once the window is scrolled more than a few pixels from the top. */
export function useScrolled() {
  const [scrolled, setScrolled] = useState(false)

  // Layout effect: on a reload mid-page the first paint after hydration already has the right state.
  useLayoutEffect(() => {
    const update = () => {
      setScrolled(prev => window.scrollY > (prev ? OFF_AT_OR_BELOW : ON_ABOVE))
    }
    update()
    window.addEventListener('scroll', update, {passive: true})
    return () => {
      window.removeEventListener('scroll', update)
    }
  }, [])

  return scrolled
}
