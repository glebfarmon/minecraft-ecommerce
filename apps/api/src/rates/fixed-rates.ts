import type {EurPlnRate, ExchangeRates} from './exchange-rates'
import {addDays} from './warsaw-day'

/** A constant rate for the e2e stack and tests; never calls the network. */
export class FixedRates implements ExchangeRates {
  constructor(private readonly rate: string) {}

  eurPlnBefore(day: string): Promise<EurPlnRate | null> {
    return Promise.resolve({rate: this.rate, date: addDays(day, -1)})
  }
}
