import type {EurPlnRate, ExchangeRates} from './exchange-rates'
import {addDays} from './warsaw-day'

const BASE = 'https://api.nbp.pl/api/exchangerates/rates/a/eur'
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** NBP table A, the rate Polish accounting uses. Free and keyless. */
export class NbpRates implements ExchangeRates {
  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 5000
  ) {}

  async eurPlnBefore(day: string): Promise<EurPlnRate | null> {
    // Ten days always contain a table, even around Easter or New Year.
    const url = `${BASE}/${addDays(day, -10)}/${addDays(day, -1)}/?format=json`
    const response = await this.fetchFn(url, {signal: AbortSignal.timeout(this.timeoutMs)})
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`NBP answered ${String(response.status)}`)
    const body: unknown = await response.json()
    const last = (body as {rates?: unknown} | null)?.rates
    const entry: unknown = Array.isArray(last) ? last[last.length - 1] : undefined
    const {effectiveDate, mid} = (entry ?? {}) as {effectiveDate?: unknown; mid?: unknown}
    if (
      typeof effectiveDate !== 'string' ||
      !DAY.test(effectiveDate) ||
      typeof mid !== 'number' ||
      !Number.isFinite(mid) ||
      mid <= 0
    )
      throw new Error('NBP answered an unexpected body')
    // Formatting only: the arithmetic on the rate happens later in Prisma.Decimal.
    return {rate: mid.toFixed(4), date: effectiveDate}
  }
}
