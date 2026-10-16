import type {Locale} from '@/i18n/routing'

import type {PublicRules as SharedPublicRules} from '@shop/shared/rules'

/** A text and the language it is actually in (EN when a PL text fell back). */
export type Localized = {value: string; lang: Locale}

/** Shape of `GET /api/content/rules?locale=` (spec §5), from the shared contract. */
export type PublicRules = SharedPublicRules

export type RuleItem = {id: string; number: string; anchor: string; text: Localized}

export type RuleSection = {
  id: string
  number: number
  anchor: string
  title: Localized
  items: RuleItem[]
}
