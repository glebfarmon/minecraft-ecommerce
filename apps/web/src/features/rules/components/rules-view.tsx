'use client'

import {MorphPopover} from '@/components/morph-popover'
import {RULES_SEARCH_DELAY_MS} from '@/config/rules'
import {RulesSearch} from '@/features/rules/components/rules-search'
import {RulesSection} from '@/features/rules/components/rules-section'
import {RulesToc} from '@/features/rules/components/rules-toc'
import {useActiveSection} from '@/features/rules/hooks/use-active-section'
import {filterRules} from '@/features/rules/lib/filter-rules'
import type {RuleSection} from '@/features/rules/types'
import {useDebouncedValue} from '@/hooks/use-debounced-value'
import {List, Search} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'

const DOCK_BUTTON =
  'size-11 border border-border bg-surface/90 text-fg shadow-[0_12px_32px_rgb(0_0_0/0.45)] backdrop-blur hover:border-white/25'

export function RulesView({sections, rulesPath}: {sections: RuleSection[]; rulesPath: string}) {
  const t = useTranslations('rules')
  const locale = useLocale()
  const [query, setQuery] = useState('')
  // Filter once the reader pauses; an empty box shows everything at once.
  const debounced = useDebouncedValue(query, RULES_SEARCH_DELAY_MS)
  const applied = query === '' ? '' : debounced
  const visible = filterRules(sections, applied, locale)
  const active = useActiveSection(visible.map(section => section.anchor))

  // A rule link (#r-2-3) must not land on an item the search has hidden: clear it, then scroll
  // again because the list above the target just grew.
  useEffect(() => {
    const onHash = () => {
      setQuery('')
      requestAnimationFrame(() => {
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="flex flex-col gap-8">
          <RulesSearch query={query} onQueryChange={setQuery} />
          <div className="hidden lg:block">
            <RulesToc sections={visible} active={active} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {visible.length === 0 ? (
          <div role="status" className="rounded-2xl border border-border p-10 text-center">
            <p className="text-fg/85">{t('noResults', {query: applied.trim()})}</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
              }}
              className="mt-4 rounded-full border border-border px-5 py-2 text-sm hover:border-white/30">
              {t('clearSearch')}
            </button>
          </div>
        ) : (
          visible.map(section => (
            <RulesSection
              key={section.id}
              section={section}
              query={applied}
              locale={locale}
              rulesPath={rulesPath}
            />
          ))
        )}
      </div>

      {/* Phone: search and contents stay in reach at the bottom right; hidden while the cookie
          banner occupies that corner. */}
      <div
        data-testid="rules-dock"
        className="fixed right-[var(--gutter)] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 lg:hidden [body:has([data-cookie-banner])_&]:hidden">
        <MorphPopover
          anchor="bottom-end"
          triggerLabel={t('openSearch')}
          panelLabel={t('searchLabel')}
          closeLabel={t('closeSearch')}
          triggerClassName={DOCK_BUTTON}
          panelClassName="w-[min(22rem,calc(100vw-2*var(--gutter)))]"
          trigger={<Search aria-hidden className="size-5" />}>
          {() => (
            <div className="pt-10">
              <RulesSearch query={query} onQueryChange={setQuery} inPanel />
            </div>
          )}
        </MorphPopover>
        <MorphPopover
          anchor="bottom-end"
          triggerLabel={t('openContents')}
          panelLabel={t('contents')}
          closeLabel={t('closeContents')}
          triggerClassName={DOCK_BUTTON}
          panelClassName="max-h-[70vh] w-[min(20rem,calc(100vw-2*var(--gutter)))] overflow-y-auto"
          trigger={<List aria-hidden className="size-5" />}>
          {close => <RulesToc sections={visible} active={active} onNavigate={close} />}
        </MorphPopover>
      </div>
    </div>
  )
}
