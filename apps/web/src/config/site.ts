// Brand, links and contacts. Change them here, not in the components.

/** The wordmark is set in two parts: the second one in the accent colour. */
export const SITE_NAME = {plain: 'Block', accent: 'haus'} as const

export const SERVER_IP = 'mc.mineblaze.net'
export const DISCORD_URL = 'https://discord.com'

/** Pages after Home in the navbar; the key is also the `nav` message that labels the link. */
export const PAGES = {cases: '/cases', rules: '/rules', contacts: '/contacts'} as const

/** Legal PDFs in `public/legal`, one per locale; `key` is the `footer` message that labels it. */
export const LEGAL_DOCS = ['terms', 'privacy', 'refunds', 'cookies'] as const
export const legalPath = (doc: (typeof LEGAL_DOCS)[number], locale: string) =>
  `/legal/${doc}.${locale}.pdf`
