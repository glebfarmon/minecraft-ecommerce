export const EXCHANGE_RATES = Symbol('EXCHANGE_RATES')

export interface EurPlnRate {
  /** PLN per 1 EUR, a decimal string with up to four digits. */
  rate: string
  /** The date of the table the rate comes from (YYYY-MM-DD). */
  date: string
}

export interface ExchangeRates {
  /**
   * The EUR→PLN mid rate of the last table published strictly before `day` (YYYY-MM-DD, Warsaw).
   * `null` when there is no such table. Throws when the source cannot be reached or answers
   * nonsense, so the caller can retry later.
   */
  eurPlnBefore(day: string): Promise<EurPlnRate | null>
}
