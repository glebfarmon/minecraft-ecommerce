'use client'

import {useEffect} from 'react'
import type {RefObject} from 'react'

// Below this the press is still a click on a pill, not a drag.
const DRAG_THRESHOLD = 5

/** Lets a mouse drag a horizontally scrolling element like a touch swipe. Touch and pen keep their native scrolling. */
export function useDragScroll<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let pointerId: number | null = null
    let startX = 0
    let startLeft = 0
    let dragging = false
    let swallowClick = false

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      swallowClick = false
      pointerId = e.pointerId
      startX = e.clientX
      startLeft = el.scrollLeft
      dragging = false
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return
        dragging = true
        // Capture only once it is a drag, so a plain click still reaches the pill under the cursor.
        el.setPointerCapture(e.pointerId)
        el.style.scrollBehavior = 'auto' // smooth scrolling would lag behind the cursor
        el.dataset.dragging = 'true'
      }
      el.scrollLeft = startLeft - dx
    }
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      if (!dragging) return
      dragging = false
      el.style.scrollBehavior = ''
      delete el.dataset.dragging
      // The click that ends a drag must not select the pill it was released over.
      swallowClick = true
      setTimeout(() => {
        swallowClick = false
      }, 0)
    }
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return
      e.stopPropagation()
      e.preventDefault()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onEnd)
    el.addEventListener('pointercancel', onEnd)
    el.addEventListener('click', onClick, true)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onEnd)
      el.removeEventListener('pointercancel', onEnd)
      el.removeEventListener('click', onClick, true)
    }
  }, [ref])
}
