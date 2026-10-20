export const LOCALES = ['en', 'pl'] as const
export type AdminLocale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: AdminLocale = 'en'
export const LOCALE_COOKIE = 'admin_locale'

export function parseLocale(value: string | undefined): AdminLocale {
  return LOCALES.find(locale => locale === value) ?? DEFAULT_LOCALE
}
