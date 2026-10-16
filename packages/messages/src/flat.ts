import en from '../en.json'
import pl from '../pl.json'

export function flattenMessages(messages: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(messages).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null
        ? Object.entries(flattenMessages(v as object, `${prefix}${k}.`))
        : [[`${prefix}${k}`, String(v)]]
    )
  )
}

const FLAT = {en: flattenMessages(en), pl: flattenMessages(pl)}

/** The file default for one key, or undefined when the key does not exist. */
export const getMessage = (locale: 'en' | 'pl', key: string): string | undefined =>
  FLAT[locale][key]
