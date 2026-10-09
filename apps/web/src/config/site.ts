// Brand defaults, links and contacts. Change them here, not in the components.

/** Brand values an admin will edit (spec §6.4). Phase 2 loads them from the API; these are the fallback. */
export type SiteSettings = {
  /** The wordmark is set in two parts: the second one in the accent colour. */
  siteName: {plain: string; accent: string}
  serverIp: string
  discordUrl: string
  supportEmail: string
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: {plain: 'Block', accent: 'haus'},
  serverIp: 'mc.mineblaze.net',
  discordUrl: 'https://discord.com',
  supportEmail: 'support@blockhaus.example'
}

/** Pages after Home in the navbar; the key is also the `nav` message that labels the link. */
export const PAGES = {cases: '/cases', rules: '/rules', contacts: '/contacts'} as const

/** Legal PDFs in `public/legal`, one per locale; `key` is the `footer` message that labels it. */
export const LEGAL_DOCS = ['terms', 'privacy', 'refunds', 'cookies'] as const
export const legalPath = (doc: (typeof LEGAL_DOCS)[number], locale: string) =>
  `/legal/${doc}.${locale}.pdf`
