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

  // Arrows, clicks and deep links can select something that is scrolled out of view. Only the row scrolls:
  // scrollIntoView would also move the page whenever the row sits below the fold, e.g. on every load.
  useEffect(() => {
    const row = ref.current?.querySelector('.scroll-fade-x')
    const pill = row?.querySelector('[aria-pressed="true"]')
    if (!row || !pill) return
    const p = pill.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    row.scrollBy({left: p.left + p.width / 2 - (r.left + r.width / 2)})
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
