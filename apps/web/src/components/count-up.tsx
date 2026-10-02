'use client'

import {motion, useReducedMotion, useSpring, useTransform} from 'motion/react'
import {useEffect} from 'react'

/** A whole number that eases to its new value instead of jumping; the digits update without re-rendering. */
export function CountUp({value}: {value: number}) {
  const reduce = useReducedMotion()
  const spring = useSpring(value, {stiffness: 120, damping: 24, restDelta: 0.5})
  const text = useTransform(spring, v => String(Math.round(v)))

  useEffect(() => {
    if (reduce) spring.jump(value)
    else spring.set(value)
  }, [value, reduce, spring])

  return <motion.span>{text}</motion.span>
}
