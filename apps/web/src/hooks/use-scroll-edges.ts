'use client'

import {useLayoutEffect, useState} from 'react'
import type {RefObject} from 'react'

// Sub-pixel scroll positions on fractional-DPR screens would otherwise leave a permanent 1px "more content" fade.
const EDGE_TOLERANCE = 1

/** Whether a horizontally scrolling element has content hidden before its start / after its end. */
export function useScrollEdges<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [edges, setEdges] = useState({start: false, end: false})

  // Layout effect: the first paint after hydration already has the right fades.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const start = el.scrollLeft > EDGE_TOLERANCE
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_TOLERANCE
      setEdges(prev => (prev.start === start && prev.end === end ? prev : {start, end}))
    }
    update()
    el.addEventListener('scroll', update, {passive: true})
    // Size changes (window resize, font load, longer translations) fire no scroll event.
    const observer = new ResizeObserver(update)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [ref])

  return edges
}
