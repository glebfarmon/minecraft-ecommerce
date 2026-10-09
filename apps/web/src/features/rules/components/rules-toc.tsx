'use client'

import type {RuleSection} from '@/features/rules/types'
import {useLocale, useTranslations} from 'next-intl'

export function RulesToc({
  sections,
  active,
  onNavigate
}: {
  sections: RuleSection[]
  active: string | undefined
  onNavigate?: () => void
}) {
  const t = useTranslations('rules')
  const locale = useLocale()
  return (
    <nav aria-label={t('contents')}>
      <p className="eyebrow">{t('contents')}</p>
      <ol className="mt-4 flex flex-col border-l border-border">
        {sections.map(section => (
          <li key={section.id}>
            <a
              href={`#${section.anchor}`}
              aria-current={section.anchor === active ? 'location' : undefined}
              onClick={onNavigate}
              className="-ml-px flex items-center gap-3 border-l-2 border-transparent py-2.5 pr-2 pl-4 text-fg/70 transition-colors hover:text-fg aria-[current=location]:border-accent aria-[current=location]:text-fg">
              <span className="tabular w-5 shrink-0 text-sm text-accent">{section.number}</span>
              <span
                lang={section.title.lang === locale ? undefined : section.title.lang}
                className="min-w-0 flex-1 break-words">
                {section.title.value}
              </span>
              <span className="tabular shrink-0 text-xs text-muted">{section.items.length}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
