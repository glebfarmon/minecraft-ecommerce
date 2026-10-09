import {findMatches} from '@/features/rules/lib/normalize-search'
import type {ReactNode} from 'react'

export function Highlight({text, query, locale}: {text: string; query: string; locale: string}) {
  const matches = findMatches(text, query, locale)
  if (matches.length === 0) return text
  const parts: ReactNode[] = []
  let last = 0
  matches.forEach(([start, end], i) => {
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <mark key={i} className="rounded-sm bg-accent-soft text-fg">
        {text.slice(start, end)}
      </mark>
    )
    last = end
  })
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
