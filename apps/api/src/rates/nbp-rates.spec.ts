import {NbpRates} from './nbp-rates'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), {status}))

describe('NbpRates', () => {
  it('asks for the ten days before the day and returns the last table', async () => {
    const fetchFn = jest.fn(() =>
      json({
        rates: [
          {effectiveDate: '2026-10-15', mid: 4.2811},
          {effectiveDate: '2026-10-16', mid: 4.2875}
        ]
      })
    )
    const rates = new NbpRates(fetchFn)
    await expect(rates.eurPlnBefore('2026-10-19')).resolves.toEqual({
      rate: '4.2875',
      date: '2026-10-16'
    })
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      'https://api.nbp.pl/api/exchangerates/rates/a/eur/2026-10-09/2026-10-18/?format=json'
    )
  })

  it('pads the mid to four decimals', async () => {
    const rates = new NbpRates(() => json({rates: [{effectiveDate: '2026-10-16', mid: 4.3}]}))
    await expect(rates.eurPlnBefore('2026-10-19')).resolves.toMatchObject({rate: '4.3000'})
  })

  it('returns null when NBP has no table in the range (404)', async () => {
    const rates = new NbpRates(() => json('Not Found', 404))
    await expect(rates.eurPlnBefore('2026-10-19')).resolves.toBeNull()
  })

  it('throws on a server error', async () => {
    const rates = new NbpRates(() => json('boom', 500))
    await expect(rates.eurPlnBefore('2026-10-19')).rejects.toThrow(/500/)
  })

  it.each([
    ['not an object', 'nope'],
    ['no rates', {}],
    ['empty rates', {rates: []}],
    ['bad mid', {rates: [{effectiveDate: '2026-10-16', mid: 'x'}]}],
    ['bad date', {rates: [{effectiveDate: 'soon', mid: 4.3}]}]
  ])('throws on malformed JSON: %s', async (_name, body) => {
    const rates = new NbpRates(() => json(body))
    await expect(rates.eurPlnBefore('2026-10-19')).rejects.toThrow()
  })

  it('throws when the network fails', async () => {
    const rates = new NbpRates(() => Promise.reject(new Error('offline')))
    await expect(rates.eurPlnBefore('2026-10-19')).rejects.toThrow('offline')
  })

  it('throws when NBP does not answer in time', async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'))
        })
      })) as unknown as typeof fetch
    await expect(new NbpRates(hang, 20).eurPlnBefore('2026-10-19')).rejects.toThrow()
  })
})
