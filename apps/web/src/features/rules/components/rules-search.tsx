'use client'

import {Search, X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useRef} from 'react'

const EDITABLE = 'input, textarea, select, [contenteditable="true"]'

export function RulesSearch({
  query,
  onQueryChange,
  inPanel = false
}: {
  query: string
  onQueryChange: (query: string) => void
  /** Inside the phone search panel: focus on open; the page's own box keeps the "/" shortcut. */
  inPanel?: boolean
}) {
  const t = useTranslations('rules')
  const input = useRef<HTMLInputElement>(null)

  // After the panel's own focus handling, which runs after this child's effects.
  useEffect(() => {
    if (!inPanel) return
    const frame = requestAnimationFrame(() => {
      input.current?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [inPanel])

  // "/" jumps to search, unless the reader is typing elsewhere or using a modified shortcut.
  useEffect(() => {
    if (inPanel) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest(EDITABLE)) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [inPanel])

  return (
    <div role="search" className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
      />
      <input
        ref={input}
        type="search"
        value={query}
        onChange={event => {
          onQueryChange(event.target.value)
        }}
        aria-label={t('searchLabel')}
        aria-keyshortcuts="/"
        placeholder={t('searchPlaceholder')}
        className="h-14 w-full rounded-2xl border border-border bg-surface/60 pr-12 pl-11 text-fg placeholder:text-muted focus:border-white/30 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          aria-label={t('clearSearch')}
          onClick={() => {
            onQueryChange('')
            input.current?.focus()
          }}
          className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg">
          <X className="size-4" />
        </button>
      ) : inPanel ? null : (
        <kbd
          title={t('searchShortcut')}
          className="absolute top-1/2 right-4 -translate-y-1/2 rounded-md border border-border px-1.5 font-mono text-xs text-muted">
          /
        </kbd>
      )}
    </div>
  )
}
