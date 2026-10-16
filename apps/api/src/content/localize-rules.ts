import type {PublicRules, RulesDocument} from '@shop/shared/rules'

type Locale = 'en' | 'pl'
const pick = (text: {en: string; pl?: string}, locale: Locale) =>
  locale === 'pl' && text.pl?.trim()
    ? {value: text.pl, lang: 'pl' as const}
    : {value: text.en, lang: 'en' as const}

/** Published document → public shape; an empty PL field falls back to EN and says so (spec §6.5). */
export function localizeRules(doc: RulesDocument, publishedAt: Date, locale: Locale): PublicRules {
  return {
    publishedAt: publishedAt.toISOString(),
    sections: doc.sections.map(s => ({
      id: s.id,
      title: pick(s.title, locale),
      items: s.items.map(i => ({id: i.id, text: pick(i.text, locale)}))
    }))
  }
}
