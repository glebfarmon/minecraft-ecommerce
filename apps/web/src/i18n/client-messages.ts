import type {AbstractIntlMessages} from 'next-intl'

/** Message namespaces read by Client Components; the rest (FAQ, footer, ...) render on the server and never ship to the browser. */
export const CLIENT_NAMESPACES = ['nav', 'cart', 'catalog', 'product', 'hero', 'ip'] as const

export function pickClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {}
  for (const ns of CLIENT_NAMESPACES) {
    const value = messages[ns]
    if (value !== undefined) picked[ns] = value
  }
  return picked
}
