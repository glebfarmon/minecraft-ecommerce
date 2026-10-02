'use client'

import {animate, motion, useMotionValue, useReducedMotion, useTransform} from 'motion/react'
import {useEffect} from 'react'

const plain = (n: number) => String(n)

/**
 * A whole number that eases to its new value, settling slowly at the end; the digits update
 * without re-rendering. `format` receives the rounded number each frame (e.g. to add a currency).
 */
export function CountUp({
  value,
  duration = 2,
  format = plain
}: {
  value: number
  duration?: number
  format?: (n: number) => string
}) {
  const reduce = useReducedMotion()
  const count = useMotionValue(value)
  const text = useTransform(count, v => format(Math.round(v)))

  useEffect(() => {
    if (reduce) {
      count.set(value)
      return
    }
    const controls = animate(count, value, {duration, ease: [0.22, 1, 0.36, 1]})
    return () => {
      controls.stop()
    }
  }, [value, reduce, count, duration])

  return <motion.span>{text}</motion.span>
}
