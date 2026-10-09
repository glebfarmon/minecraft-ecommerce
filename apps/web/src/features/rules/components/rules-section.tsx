'use client'

import {Highlight} from '@/features/rules/components/highlight'
import {RuleRow} from '@/features/rules/components/rule-row'
import type {RuleSection} from '@/features/rules/types'
import {BookOpen} from 'lucide-react'
import {useTranslations} from 'next-intl'

export function RulesSection({
  section,
  query,
  locale,
  rulesPath
}: {
  section: RuleSection
  query: string
  locale: string
  rulesPath: string
}) {
  const t = useTranslations('rules')
  const titleId = `${section.anchor}-title`
  return (
    <section
      id={section.anchor}
      aria-labelledby={titleId}
      className="scroll-mt-28 overflow-hidden rounded-2xl border border-border bg-surface/60">
      <header className="flex items-baseline justify-between gap-4 border-b border-border px-6 py-5">
        <h2
          id={titleId}
          className="flex min-w-0 items-baseline gap-3 font-display text-xl font-bold tracking-wide uppercase">
          <BookOpen aria-hidden className="size-5 shrink-0 self-center text-accent" />
          <span className="text-accent">{section.number}.</span>{' '}
          <span
            lang={section.title.lang === locale ? undefined : section.title.lang}
            className="min-w-0 break-words">
            <Highlight text={section.title.value} query={query} locale={locale} />
          </span>
        </h2>
        <span className="tabular shrink-0 text-sm text-muted">
          {t('itemCount', {count: section.items.length})}
        </span>
      </header>
      <ol className="divide-y divide-line px-2 py-2">
        {section.items.map(item => (
          <RuleRow key={item.id} item={item} query={query} locale={locale} rulesPath={rulesPath} />
        ))}
      </ol>
    </section>
  )
}
