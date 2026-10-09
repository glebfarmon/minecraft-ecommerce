'use client'

import {MorphPopover} from '@/components/morph-popover'
import {RulesSearch} from '@/features/rules/components/rules-search'
import {RulesSection} from '@/features/rules/components/rules-section'
import {RulesToc} from '@/features/rules/components/rules-toc'
import {useActiveSection} from '@/features/rules/hooks/use-active-section'
import {filterRules} from '@/features/rules/lib/filter-rules'
import type {RuleSection} from '@/features/rules/types'
import {List} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'

export function RulesView({sections, rulesPath}: {sections: RuleSection[]; rulesPath: string}) {
  const t = useTranslations('rules')
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const visible = filterRules(sections, query, locale)
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
      <aside className="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
        <RulesSearch query={query} onQueryChange={setQuery} />
        <div className="hidden lg:block">
          <RulesToc sections={visible} active={active} />
        </div>
        <div className="flex justify-end lg:hidden">
          <MorphPopover
            triggerLabel={t('openContents')}
            panelLabel={t('contents')}
            closeLabel={t('closeContents')}
            triggerClassName="h-11 border border-border px-4 text-sm font-medium hover:border-white/25"
            panelClassName="w-[min(20rem,calc(100vw-2*var(--gutter)))] p-4"
            trigger={
              <>
                <List aria-hidden className="size-4 text-muted" />
                <span>{t('contents')}</span>
              </>
            }>
            {close => <RulesToc sections={visible} active={active} onNavigate={close} />}
          </MorphPopover>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {visible.length === 0 ? (
          <div role="status" className="rounded-2xl border border-border p-10 text-center">
            <p className="text-fg/85">{t('noResults', {query: query.trim()})}</p>
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
              query={query}
              locale={locale}
              rulesPath={rulesPath}
            />
          ))
        )}
      </div>
    </div>
  )
}
