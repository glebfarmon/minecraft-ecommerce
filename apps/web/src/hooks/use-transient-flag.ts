'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

/** A flag that turns on at `trigger()` and off again after `ms`; triggering again restarts the timer. */
export function useTransientFlag(ms: number) {
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const trigger = useCallback(() => {
    clearTimeout(timer.current)
    setOn(true)
    timer.current = setTimeout(() => {
      setOn(false)
    }, ms)
  }, [ms])
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    []
  )
  return [on, trigger] as const
}
