import {Hint} from '@/components/hint'
import {API_ORIGIN} from '@/lib/api-origin'
import {brandInitial} from '@/lib/brand'
import Link from 'next/link'
import 'server-only'

import {DEFAULT_SITE_SETTINGS, type SiteSettings} from '@shop/shared/content'

/** The site name from Content → Settings; the built-in default if the API cannot answer. */
async function siteName(): Promise<SiteSettings['siteName']> {
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

export async function BrandMark() {
  const name = await siteName()
  const full = `${name.plain}${name.accent}`
  return (
    <Hint label={full} side="right">
      <Link
        href="/"
        aria-label={full}
        className="mb-2 flex size-10 items-center justify-center rounded-full bg-accent font-semibold text-on-accent transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none">
        {brandInitial(name)}
      </Link>
    </Hint>
  )
}
