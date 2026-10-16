import type {Locale} from '@/i18n/routing'
import {contentFetch} from '@/lib/content-fetch'

import {PublicMessagesSchema} from '@shop/shared/content'

/** Admin text overrides for `locale` as `{flatKey: value}`; `{}` when the API cannot answer (file texts win). */
export async function getMessageOverrides(locale: Locale): Promise<Record<string, string>> {
  try {
    return (
      (await contentFetch(
        `/api/content/messages?locale=${locale}`,
        PublicMessagesSchema,
        'content-messages'
      )) ?? {}
    )
  } catch (error) {
    console.error(error)
    return {}
  }
}
