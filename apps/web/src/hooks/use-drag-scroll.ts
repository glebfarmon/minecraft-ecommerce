'use client'

import {useEffect} from 'react'
import type {RefObject} from 'react'

// Below this the press is still a click on a pill, not a drag.
const DRAG_THRESHOLD = 5
// Release speed is measured over the last moments of the drag; a held pause means no fling.
const VELOCITY_WINDOW_MS = 100
const MIN_FLING_SPEED = 0.1 // px/ms
const STOP_SPEED = 0.02 // px/ms
const DECAY_MS = 325 // speed falls to 1/e every 325ms, close to a touchpad / phone coast

/** Lets a mouse drag a horizontally scrolling element like a touch swipe, with momentum on release. Touch and pen keep their native scrolling. */
export function useDragScroll<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let pointerId: number | null = null
    let startX = 0
    let startLeft = 0
    let dragging = false
    let swallowClick = false
    let samples: {t: number; x: number}[] = []
    let frame: number | null = null

    const stopFling = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      el.style.scrollBehavior = ''
    }
    const fling = (initialSpeed: number) => {
      let speed = initialSpeed
      let last = performance.now()
      const step = (now: number) => {
        const dt = now - last
        last = now
        const before = el.scrollLeft
        el.scrollLeft = before + speed * dt
        speed *= Math.exp(-dt / DECAY_MS)
        // Stopped by slowing down or by hitting either end of the range.
        if (Math.abs(speed) < STOP_SPEED || el.scrollLeft === before) {
          stopFling()
          return
        }
        frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      swallowClick = false
      stopFling()
      samples = []
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
      const now = performance.now()
      samples = [...samples.filter(s => now - s.t <= VELOCITY_WINDOW_MS), {t: now, x: e.clientX}]
    }
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      if (!dragging) return
      dragging = false
      delete el.dataset.dragging
      // The click that ends a drag must not select the pill it was released over.
      swallowClick = true
      setTimeout(() => {
        swallowClick = false
      }, 0)

      const now = performance.now()
      const recent = samples.filter(s => now - s.t <= VELOCITY_WINDOW_MS)
      const first = recent[0]
      const lastSample = recent.at(-1)
      const span = first && lastSample ? lastSample.t - first.t : 0
      // Scrolling moves opposite to the pointer.
      const speed = first && lastSample && span > 0 ? -(lastSample.x - first.x) / span : 0
      if (Math.abs(speed) >= MIN_FLING_SPEED) fling(speed)
      else el.style.scrollBehavior = ''
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
    // A wheel or trackpad scroll takes over from a coasting drag.
    el.addEventListener('wheel', stopFling, {passive: true})
    return () => {
      stopFling()
      el.removeEventListener('wheel', stopFling)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onEnd)
      el.removeEventListener('pointercancel', onEnd)
      el.removeEventListener('click', onClick, true)
    }
  }, [ref])
}
