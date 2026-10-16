import type {PublicRules} from '@/features/rules/types'
import type {Locale} from '@/i18n/routing'
import {contentFetch} from '@/lib/content-fetch'

import {PublicRulesSchema} from '@shop/shared/rules'

/**
 * Published rules for `locale` from `/api/content/rules` (ADR 0007/0008). `null` when nothing is published (404,
 * not logged) or when the API cannot answer (logged); the page then shows the unavailable state.
 */
export async function getRules(locale: Locale): Promise<PublicRules | null> {
  try {
    return await contentFetch(
      `/api/content/rules?locale=${locale}`,
      PublicRulesSchema,
      'content-rules'
    )
  } catch (error) {
    console.error(error)
    return null
  }
}
