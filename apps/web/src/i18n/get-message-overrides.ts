import type {Locale} from '@/i18n/routing'
import {loadContent} from '@/lib/content-fetch'
import {cache} from 'react'

import {PublicMessagesSchema} from '@shop/shared/content'

/**
 * Admin text overrides for `locale` as `{flatKey: value}`; `{}` when the API cannot answer (file texts win).
 * `cache`: one fetch per request (the timeout signal turns off Next's own fetch dedupe).
 */
export const getMessageOverrides = cache((locale: Locale): Promise<Record<string, string>> =>
  loadContent(
    `/api/content/messages?locale=${locale}`,
    PublicMessagesSchema,
    'content-messages',
    {}
  )
)
