import {DEFAULT_SITE_SETTINGS, type SiteSettings} from '@/config/site'

/**
 * Brand settings. Phase 1 returns the defaults; phase 2 fetches `/api/content/settings` behind
 * `'use cache'` and falls back to `DEFAULT_SITE_SETTINGS` (spec §6.2), keeping this signature.
 */
export function getSiteSettings(): Promise<SiteSettings> {
  return Promise.resolve(DEFAULT_SITE_SETTINGS)
}
