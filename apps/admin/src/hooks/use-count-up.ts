'use client'

import {animate} from 'motion/react'
import {useEffect, useRef, useState} from 'react'

/** A number that runs up to `to` (from 0 on mount, from the last value after a change). */
export function useCountUp(to: number, durationMs = 700): number {
  const [value, setValue] = useState(0)
  const last = useRef(0)
  useEffect(() => {
    const controls = animate(last.current, to, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => {
        last.current = v
        setValue(v)
      }
    })
    return () => {
      controls.stop()
    }
  }, [to, durationMs])
  return value
}
