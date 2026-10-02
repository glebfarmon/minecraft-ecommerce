'use client'

import {
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform
} from 'motion/react'
import {useEffect} from 'react'
import type {ReactNode} from 'react'

const EASE = [0.16, 1, 0.3, 1] as const
const FOLLOW = {stiffness: 60, damping: 20, mass: 0.6}

/** Client boundary for the hero's entrance; the copy inside stays server-rendered. Reduced motion keeps the fades and drops the movement. */
export function HeroMotion({children}: {children: ReactNode}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/** Steve rises from behind the bottom edge; with a mouse he and the glow behind him drift a few pixels against each other. */
export function HeroSteve({className, children}: {className: string; children: ReactNode}) {
  const reduce = useReducedMotion()
  // Pointer position across the window, -1 (left / top) to 1 (right / bottom).
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const steveX = useSpring(useTransform(px, [-1, 1], [-8, 8]), FOLLOW)
  const glowX = useSpring(useTransform(px, [-1, 1], [16, -16]), FOLLOW)
  const glowY = useSpring(useTransform(py, [-1, 1], [10, -10]), FOLLOW)

  useEffect(() => {
    // Touch and pen have no hover, and a narrow layout has no room for the drift.
    if (reduce || !window.matchMedia('(hover: hover) and (min-width: 768px)').matches) return
    const onMove = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1)
      py.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onLeave = () => {
      px.set(0)
      py.set(0)
    }
    window.addEventListener('pointermove', onMove, {passive: true})
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, px, py])

  return (
    // Transform only: the image is painted from the first frame, so the LCP does not wait for the entrance.
    <motion.div
      className={className}
      initial={{y: '8%'}}
      animate={{y: 0}}
      transition={{duration: 0.7, ease: EASE}}
      style={{x: steveX}}>
      <motion.div
        aria-hidden
        // A gradient, not `blur`: Safari drops a blur filter once the element's opacity/scale animation ends.
        className="absolute -inset-x-[2%] top-[8%] bottom-[0%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_30%,transparent)_40%,transparent)]"
        initial={{opacity: 0, scale: 0.85}}
        animate={{opacity: 1, scale: 1}}
        transition={{duration: 0.8, ease: EASE}}
        style={{x: glowX, y: glowY}}
      />
      {children}
    </motion.div>
  )
}
