import type {Locale} from '@/i18n/routing'

/** Rules as an editor writes them, in one language. */
export type RulesSource = {
  /** ISO timestamp of the published edition. */
  publishedAt: string
  sections: {id: string; title: string; items: {id: string; text: string}[]}[]
}

/** A text and the language it is actually in (EN when a PL text fell back). */
export type Localized = {value: string; lang: Locale}

/** Shape of `GET /api/content/rules?locale=` (spec §5); `getRules` returns it in both phases. */
export type PublicRules = {
  publishedAt: string
  sections: {id: string; title: Localized; items: {id: string; text: Localized}[]}[]
}

export type RuleItem = {id: string; number: string; anchor: string; text: Localized}

export type RuleSection = {
  id: string
  number: number
  anchor: string
  title: Localized
  items: RuleItem[]
}
