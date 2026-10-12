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
      // Keyed by query: a new search draws new marks, so the sweep plays for each search.
      <mark
        key={`${query}:${String(i)}`}
        className="rule-mark animate-mark-in rounded-sm text-fg motion-reduce:animate-none">
        {text.slice(start, end)}
      </mark>
    )
    last = end
  })
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
