'use client'

import type {Currency} from '@/config/currencies'
import {formatPrice} from '@/lib/catalog'
import {animate, motion, useMotionValue, useReducedMotion, useTransform} from 'motion/react'
import {useLocale} from 'next-intl'
import {useEffect, useRef} from 'react'

/**
 * An amount that rolls to its new value (a promo code applied, the cart changed), cent by cent,
 * settling fast at the end. A drop (a discount) glows in the accent while it rolls. The rolling
 * digits are hidden from screen readers; they read the final value, announced politely when `live`.
 * Reduced motion: the new value appears at once.
 */
export function AnimatedMoney({
  minor,
  currency,
  live = false,
  glow = true,
  className = ''
}: {
  minor: number
  currency: Currency
  /** Announce changes; one per screen, or a total is read out several times. */
  live?: boolean
  /** Tint a drop in the accent; off where the amount already sits on the accent. */
  glow?: boolean
  className?: string
}) {
  const locale = useLocale()
  const reduce = useReducedMotion()
  const value = useMotionValue(minor)
  const text = useTransform(value, v => formatPrice(Math.round(v), currency, locale))
  const span = useRef<HTMLSpanElement>(null)
  const final = formatPrice(minor, currency, locale)

  useEffect(() => {
    const from = value.get()
    if (reduce || from === minor) {
      value.jump(minor)
      return
    }
    const el = span.current
    if (glow && minor < from) el?.setAttribute('data-drop', '')
    const controls = animate(value, minor, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => el?.removeAttribute('data-drop')
    })
    return () => {
      controls.stop()
      el?.removeAttribute('data-drop')
    }
  }, [minor, reduce, value, glow])

  return (
    <span className={className}>
      <motion.span
        ref={span}
        aria-hidden="true"
        data-testid="animated-money"
        className="tabular transition-colors duration-500 ease-out data-drop:text-accent">
        {reduce ? final : text}
      </motion.span>
      {live ? (
        <span role="status" aria-live="polite" className="sr-only">
          {final}
        </span>
      ) : (
        <span className="sr-only">{final}</span>
      )}
    </span>
  )
}
