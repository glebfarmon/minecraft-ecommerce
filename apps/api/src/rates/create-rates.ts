import type {ExchangeRates} from './exchange-rates'
import {FixedRates} from './fixed-rates'
import {NbpRates} from './nbp-rates'

/** `EXCHANGE_RATES`: `nbp` (default) or `fixed` with `FIXED_EUR_PLN` (default 4.3000). */
export function createExchangeRates(raw: Partial<Record<string, string>>): ExchangeRates {
  // `.env.example` ships these empty; an empty value means unset.
  const kind = raw.EXCHANGE_RATES || 'nbp'
  if (kind === 'nbp') return new NbpRates()
  if (kind === 'fixed') {
    const rate = raw.FIXED_EUR_PLN || '4.3000'
    if (!/^\d+\.\d{1,4}$/.test(rate) || Number(rate) <= 0)
      throw new Error(`FIXED_EUR_PLN must be a decimal like 4.3000, got "${rate}"`)
    return new FixedRates(rate)
  }
  throw new Error(`EXCHANGE_RATES must be "nbp" or "fixed", got "${kind}"`)
}
