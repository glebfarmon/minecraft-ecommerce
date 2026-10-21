import {API_ORIGIN} from '@/lib/api-origin'
import 'server-only'

import {DEFAULT_SITE_SETTINGS, type SiteSettings} from '@shop/shared/content'

/** The site name from Content → Settings; the built-in default if the API cannot answer. */
export async function getSiteName(): Promise<SiteSettings['siteName']> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/content/settings`, {
      next: {revalidate: 60},
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) return DEFAULT_SITE_SETTINGS.siteName
    return ((await res.json()) as SiteSettings).siteName
  } catch {
    return DEFAULT_SITE_SETTINGS.siteName
  }
}

/** The name as one string: `plain` + `accent`. */
export async function getSiteTitle(): Promise<string> {
  const name = await getSiteName()
  return `${name.plain}${name.accent}`
}
