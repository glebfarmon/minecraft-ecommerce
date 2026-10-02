// Currencies the shop sells in. Add one here and it appears in the settings menu and the cookie check.

export const CURRENCIES = [
  {code: 'EUR', symbol: '€'},
  {code: 'PLN', symbol: 'zł'}
] as const

export type Currency = (typeof CURRENCIES)[number]['code']

export const DEFAULT_CURRENCY: Currency = 'EUR'

export const isCurrency = (value: unknown): value is Currency =>
  CURRENCIES.some(c => c.code === value)
