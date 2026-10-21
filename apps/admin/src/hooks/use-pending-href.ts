'use client'

import {type MouseEvent, useState} from 'react'

/**
 * The href of a link just clicked, until the pathname changes. Navigation commits only when the
 * next page is ready, so a nav marks the clicked item with this at once instead of waiting.
 * Modified and non-primary clicks open a new tab or window: `mark` ignores them.
 */
export function usePendingHref(pathname: string): {
  pending: string | null
  mark: (href: string) => (e: MouseEvent) => void
} {
  const [pending, setPending] = useState<string | null>(null)
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setPending(null)
  }
  const mark = (href: string) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    setPending(href)
  }
  return {pending, mark}
}
