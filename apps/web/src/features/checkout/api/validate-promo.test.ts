import type {ValidatePromoRequest} from '@shop/shared/promo'

import {validatePromo} from './validate-promo'

const body: ValidatePromoRequest = {
  code: 'ASF14',
  currency: 'EUR',
  lines: [{server: 'survival', slug: 'vip', quantity: 1}]
}

const reply = (status: number, json: unknown) =>
  jest.fn().mockResolvedValue({status, ok: status >= 200 && status < 300, json: () => json})

describe('validatePromo', () => {
  it('posts the body as JSON to /api/promo/validate', async () => {
    const fetchFn = reply(200, {ok: false, reason: 'not_found'})
    await validatePromo(body, fetchFn)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/promo/validate')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({'content-type': 'application/json'})
    expect(JSON.parse(init.body as string)).toEqual(body)
  })

  it('returns the discount on 200 ok', async () => {
    const ok = {ok: true, code: 'ASF14', subtotalMinor: 1000, discountMinor: 140, totalMinor: 860}
    expect(await validatePromo(body, reply(200, ok))).toEqual(ok)
  })

  it('returns the reason on 200 not ok', async () => {
    expect(await validatePromo(body, reply(200, {ok: false, reason: 'expired'}))).toEqual({
      ok: false,
      reason: 'expired'
    })
  })

  it('maps 429 to rate_limited', async () => {
    expect(await validatePromo(body, reply(429, {}))).toEqual({ok: false, reason: 'rate_limited'})
  })

  // Odd input is the API's not_found; a 400 can still slip through (e.g. a stale cart line).
  it('maps 400 to not_found', async () => {
    expect(await validatePromo(body, reply(400, {message: 'invalid'}))).toEqual({
      ok: false,
      reason: 'not_found'
    })
  })

  it('maps a malformed 200 body to network', async () => {
    expect(await validatePromo(body, reply(200, {ok: 'yes'}))).toEqual({
      ok: false,
      reason: 'network'
    })
  })

  it.each([500, 502, 503])('maps %i to network', async status => {
    expect(await validatePromo(body, reply(status, {}))).toEqual({ok: false, reason: 'network'})
  })

  it('maps a network error to network', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('failed'))
    expect(await validatePromo(body, fetchFn)).toEqual({ok: false, reason: 'network'})
  })
})
