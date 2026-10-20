'use client'

import {MORPH} from '@/config/motion'
import type {RuleSection} from '@/features/rules/types'
import {MotionConfig, motion} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'
import {useId} from 'react'

import {parseRich, toPlainText} from '@shop/shared/rules'

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
  // One id per list: the desktop list and the one in the phone popover each slide their own bar.
  const indicator = useId()
  return (
    <MotionConfig reducedMotion="user">
      <nav aria-label={t('contents')}>
        <p className="eyebrow">{t('contents')}</p>
        <ol className="mt-4 flex flex-col border-l border-border">
          {sections.map(section => (
            <li key={section.id}>
              <a
                href={`#${section.anchor}`}
                aria-current={section.anchor === active ? 'location' : undefined}
                onClick={onNavigate}
                className="relative flex items-center gap-3 py-2.5 pr-2 pl-4 text-fg/70 transition-colors hover:text-fg aria-[current=location]:text-fg">
                {section.anchor === active && (
                  <motion.span
                    data-testid="toc-indicator"
                    aria-hidden
                    layoutId={indicator}
                    transition={MORPH}
                    className="absolute inset-y-0 -left-px w-0.5 bg-accent"
                  />
                )}
                <span className="tabular w-5 shrink-0 text-sm text-accent">{section.number}</span>
                <span
                  lang={section.title.lang === locale ? undefined : section.title.lang}
                  className="min-w-0 flex-1 break-words">
                  {toPlainText(parseRich(section.title.value))}
                </span>
                <span className="tabular shrink-0 text-xs text-muted">{section.items.length}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </MotionConfig>
  )
}
