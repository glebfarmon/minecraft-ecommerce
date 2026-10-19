import type {SiteSettings} from '@shop/shared/content'

/** The letter on the rail's brand mark: the site name's first non-space character. */
export function brandInitial(name: SiteSettings['siteName']): string {
  return (name.plain + name.accent).trim().charAt(0).toUpperCase() || '?'
}
