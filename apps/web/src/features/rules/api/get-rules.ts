import {RULES_EN} from '@/features/rules/data/rules.en'
import {RULES_PL} from '@/features/rules/data/rules.pl'
import type {PublicRules, RulesSource} from '@/features/rules/types'
import type {Locale} from '@/i18n/routing'

const SOURCES: Record<Locale, RulesSource> = {en: RULES_EN, pl: RULES_PL}

/**
 * Published rules for `locale`, or `null` when nothing is published.
 * Phase 1 reads the demo files; phase 2 fetches `/api/content/rules` behind `'use cache'` (spec §6.2)
 * and keeps this signature.
 */
export function getRules(locale: Locale): Promise<PublicRules | null> {
  const source = SOURCES[locale]
  return Promise.resolve({
    publishedAt: source.publishedAt,
    sections: source.sections.map(section => ({
      id: section.id,
      title: {value: section.title, lang: locale},
      items: section.items.map(item => ({id: item.id, text: {value: item.text, lang: locale}}))
    }))
  })
}
