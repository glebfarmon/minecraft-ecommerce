'use client'

import {useEffect, useState} from 'react'

const THRESHOLD = 8

/** True once the window is scrolled more than a few pixels from the top. */
export function useScrolled() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > THRESHOLD)
    }
    update()
    window.addEventListener('scroll', update, {passive: true})
    return () => {
      window.removeEventListener('scroll', update)
    }
  }, [])

  return scrolled
}
