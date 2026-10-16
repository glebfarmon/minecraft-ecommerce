import {DEFAULT_SITE_SETTINGS, type SiteSettings} from '@/config/site'
import {loadContent} from '@/lib/content-fetch'
import {cache} from 'react'

import {SiteSettingsSchema} from '@shop/shared/content'

/**
 * Brand settings from `/api/content/settings` (ADR 0007/0008); `DEFAULT_SITE_SETTINGS` when the API cannot answer.
 * `cache`: one fetch per request (the timeout signal turns off Next's own fetch dedupe).
 */
export const getSiteSettings = cache((): Promise<SiteSettings> =>
  loadContent(
    '/api/content/settings',
    SiteSettingsSchema,
    'content-settings',
    DEFAULT_SITE_SETTINGS
  )
)
