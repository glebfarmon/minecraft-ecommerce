import {createExchangeRates} from './create-rates'
import {NbpRates} from './nbp-rates'

describe('createExchangeRates', () => {
  it('defaults to NBP', () => {
    expect(createExchangeRates({})).toBeInstanceOf(NbpRates)
    expect(createExchangeRates({EXCHANGE_RATES: 'nbp'})).toBeInstanceOf(NbpRates)
  })

  it('fixed returns the configured rate and the day before', async () => {
    const rates = createExchangeRates({EXCHANGE_RATES: 'fixed'})
    await expect(rates.eurPlnBefore('2026-10-19')).resolves.toEqual({
      rate: '4.3000',
      date: '2026-10-18'
    })
    const custom = createExchangeRates({EXCHANGE_RATES: 'fixed', FIXED_EUR_PLN: '4.5'})
    await expect(custom.eurPlnBefore('2026-10-19')).resolves.toMatchObject({rate: '4.5'})
  })

  it('treats empty values as unset (.env.example ships them empty)', () => {
    expect(createExchangeRates({EXCHANGE_RATES: '', FIXED_EUR_PLN: ''})).toBeInstanceOf(NbpRates)
  })

  it('rejects a bad fixed rate and an unknown kind at creation', () => {
    expect(() => createExchangeRates({EXCHANGE_RATES: 'fixed', FIXED_EUR_PLN: 'abc'})).toThrow(
      /FIXED_EUR_PLN/
    )
    expect(() => createExchangeRates({EXCHANGE_RATES: 'ecb'})).toThrow(/EXCHANGE_RATES/)
  })
})
