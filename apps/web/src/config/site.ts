// Brand defaults, links and contacts. Change them here, not in the components.
import {DEFAULT_SITE_SETTINGS as SHARED_DEFAULTS, type SiteSettings} from '@shop/shared/content'

/** Brand values an admin edits (spec §6.4); the API serves them, see `getSiteSettings`. */
export type {SiteSettings}

/** Dates of editions are calendar dates where the servers run, not in the visitor's or server's zone. */
export const CONTENT_TIME_ZONE = 'Europe/Warsaw'

/** Fallback when the API cannot answer; the same values the api seeds (one source in `@shop/shared`). */
export const DEFAULT_SITE_SETTINGS: SiteSettings = SHARED_DEFAULTS

/** Pages after Home in the navbar; the key is also the `nav` message that labels the link. */
export const PAGES = {cases: '/cases', rules: '/rules', contacts: '/contacts'} as const

/** Legal PDFs in `public/legal`, one per locale; `key` is the `footer` message that labels it. */
export const LEGAL_DOCS = ['terms', 'privacy', 'refunds', 'cookies'] as const
export const legalPath = (doc: (typeof LEGAL_DOCS)[number], locale: string) =>
  `/legal/${doc}.${locale}.pdf`
