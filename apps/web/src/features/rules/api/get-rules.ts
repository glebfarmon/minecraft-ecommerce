import type {PublicRules} from '@/features/rules/types'
import type {Locale} from '@/i18n/routing'
import {loadContent} from '@/lib/content-fetch'
import {cache} from 'react'

import {PublicRulesSchema} from '@shop/shared/rules'

/**
 * Published rules for `locale` from `/api/content/rules` (ADR 0007/0008). `null` when nothing is published (404,
 * not logged) or when the API cannot answer (logged); the page then shows the unavailable state. `cache`: one
 * fetch per request (the timeout signal turns off Next's own fetch dedupe).
 */
export const getRules = cache((locale: Locale): Promise<PublicRules | null> =>
  loadContent(`/api/content/rules?locale=${locale}`, PublicRulesSchema, 'content-rules', null)
)
