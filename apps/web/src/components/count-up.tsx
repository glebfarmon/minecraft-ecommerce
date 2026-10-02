'use client'

import {animate, motion, useMotionValue, useReducedMotion, useTransform} from 'motion/react'
import {useEffect} from 'react'

/** A whole number that eases to its new value, settling slowly at the end; the digits update without re-rendering. */
export function CountUp({value}: {value: number}) {
  const reduce = useReducedMotion()
  const count = useMotionValue(value)
  const text = useTransform(count, v => String(Math.round(v)))

  useEffect(() => {
    if (reduce) {
      count.set(value)
      return
    }
    const controls = animate(count, value, {duration: 2, ease: [0.22, 1, 0.36, 1]})
    return () => {
      controls.stop()
    }
  }, [value, reduce, count])

  return <motion.span>{text}</motion.span>
}
