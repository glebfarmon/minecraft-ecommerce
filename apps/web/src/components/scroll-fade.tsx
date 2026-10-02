'use client'

import {useScrollEdges} from '@/hooks/use-scroll-edges'
import {useRef} from 'react'
import type {ReactNode} from 'react'

/** Horizontal scroller with a hidden scrollbar; the edge that still has hidden content fades out. Styles: `.scroll-fade-x` in globals.css. */
export function ScrollFade({className = '', children}: {className?: string; children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null)
  const {start, end} = useScrollEdges(ref)
  return (
    <div
      ref={ref}
      data-fade-start={start}
      data-fade-end={end}
      className={`scroll-fade-x ${className}`}>
      {children}
    </div>
  )
}
