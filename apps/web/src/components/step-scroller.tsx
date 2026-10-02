'use client'

import {ScrollFade} from '@/components/scroll-fade'
import {ChevronLeft, ChevronRight} from 'lucide-react'
import {useEffect, useRef} from 'react'
import type {ReactNode} from 'react'

const ARROW =
  'grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-fg'

/**
 * A row of `aria-pressed` toggles that scrolls (fades, drags) when it does not fit, with arrows that step the selection.
 * `activeKey` is whatever identifies the selected toggle; the row keeps that toggle in view when it changes.
 */
export function StepScroller({
  label,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  activeKey,
  className = '',
  children
}: {
  label: string
  prevLabel: string
  nextLabel: string
  onPrev: () => void
  onNext: () => void
  activeKey: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Arrows, clicks and deep links can select something that is scrolled out of view.
  useEffect(() => {
    ref.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({block: 'nearest', inline: 'center'})
  }, [activeKey])

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={`relative flex items-center gap-2 ${className}`}>
      <button type="button" onClick={onPrev} aria-label={prevLabel} className={ARROW}>
        <ChevronLeft className="size-5" />
      </button>
      <ScrollFade className="flex min-w-0 gap-2 scroll-smooth p-1 motion-reduce:scroll-auto">
        {children}
      </ScrollFade>
      <button type="button" onClick={onNext} aria-label={nextLabel} className={ARROW}>
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
