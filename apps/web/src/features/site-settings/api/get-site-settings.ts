import {DEFAULT_SITE_SETTINGS, type SiteSettings} from '@/config/site'
import {contentFetch} from '@/lib/content-fetch'

import {SiteSettingsSchema} from '@shop/shared/content'

/** Brand settings from `/api/content/settings` (ADR 0007/0008); `DEFAULT_SITE_SETTINGS` when the API cannot answer. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return (
      (await contentFetch('/api/content/settings', SiteSettingsSchema, 'content-settings')) ??
      DEFAULT_SITE_SETTINGS
    )
  } catch (error) {
    console.error(error)
    return DEFAULT_SITE_SETTINGS
  }
}
