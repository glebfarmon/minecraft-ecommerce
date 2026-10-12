'use client'

import {MorphPopover} from '@/components/morph-popover'
import {MORPH} from '@/config/motion'
import {RULES_SEARCH_DELAY_MS} from '@/config/rules'
import {RulesSearch} from '@/features/rules/components/rules-search'
import {RulesSection} from '@/features/rules/components/rules-section'
import {RulesToc} from '@/features/rules/components/rules-toc'
import {useActiveSection} from '@/features/rules/hooks/use-active-section'
import {filterRules} from '@/features/rules/lib/filter-rules'
import type {RuleSection} from '@/features/rules/types'
import {useDebouncedValue} from '@/hooks/use-debounced-value'
import {List, Search} from 'lucide-react'
import {AnimatePresence, MotionConfig, motion} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'

const DOCK_BUTTON =
  'size-11 border border-border bg-surface/90 text-fg shadow-[0_12px_32px_rgb(0_0_0/0.45)] backdrop-blur hover:border-white/25'

export function RulesView({sections, rulesPath}: {sections: RuleSection[]; rulesPath: string}) {
  const t = useTranslations('rules')
  const locale = useLocale()
  const [query, setQuery] = useState('')
  // A rule link clears the search and scrolls at once: skip the slide so the scroll target is
  // measured where it will stay.
  const [jump, setJump] = useState(false)
  const changeQuery = (next: string) => {
    setJump(false)
    setQuery(next)
  }
  // Filter once the reader pauses; an empty box shows everything at once.
  const debounced = useDebouncedValue(query, RULES_SEARCH_DELAY_MS)
  const applied = query === '' ? '' : debounced
  const visible = filterRules(sections, applied, locale)
  const active = useActiveSection(visible.map(section => section.anchor))

  // A rule link (#r-2-3) must not land on an item the search has hidden: clear it, then scroll
  // again because the list above the target just grew.
  useEffect(() => {
    const onHash = () => {
      setJump(true)
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
          <RulesSearch query={query} onQueryChange={changeQuery} />
          <div className="hidden lg:block">
            <RulesToc sections={visible} active={active} />
          </div>
        </div>
      </aside>

      {/* Filtering: sections that drop out fade, the rest slide up to close the gap (position only,
          so text never stretches). No entrance on page load. */}
      <MotionConfig reducedMotion="user">
        <div className="relative flex min-w-0 flex-col gap-6">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.length === 0 ? (
              <motion.div
                key="empty"
                role="status"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0, transition: {duration: 0.12}}}
                className="rounded-2xl border border-border p-10 text-center">
                <p className="text-fg/85">{t('noResults', {query: applied.trim()})}</p>
                <button
                  type="button"
                  onClick={() => {
                    changeQuery('')
                  }}
                  className="mt-4 rounded-full border border-border px-5 py-2 text-sm hover:border-white/30">
                  {t('clearSearch')}
                </button>
              </motion.div>
            ) : (
              visible.map(section => (
                <motion.div
                  key={section.id}
                  layout={jump ? false : 'position'}
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0, transition: {duration: 0.12}}}
                  transition={{layout: MORPH, opacity: {duration: 0.2}}}>
                  <RulesSection
                    section={section}
                    query={applied}
                    locale={locale}
                    rulesPath={rulesPath}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>

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
              <RulesSearch query={query} onQueryChange={changeQuery} inPanel />
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
