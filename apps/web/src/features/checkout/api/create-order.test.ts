import type {CreateOrderRequest} from '@shop/shared/orders'

import {createOrder} from './create-order'

const body: CreateOrderRequest = {
  lines: [{server: 'survival', slug: 'vip', quantity: 2}],
  currency: 'PLN',
  locale: 'en',
  nick: 'Steve_42',
  email: 'steve@example.com',
  deliveryConsent: true,
  termsAccepted: true,
  turnstileToken: 'tok'
}

const reply = (status: number, json: unknown) =>
  jest.fn().mockResolvedValue({status, ok: status >= 200 && status < 300, json: () => json})

describe('createOrder', () => {
  it('posts the body as JSON to /api/orders', async () => {
    const fetchFn = reply(201, {publicId: 'abc', redirectUrl: 'https://pay.example/x'})
    await createOrder(body, fetchFn)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/orders')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({'content-type': 'application/json'})
    expect(JSON.parse(init.body as string)).toEqual(body)
  })

  it('returns the redirect url on 201', async () => {
    const fetchFn = reply(201, {publicId: 'abc', redirectUrl: 'https://pay.example/x'})
    expect(await createOrder(body, fetchFn)).toEqual({
      ok: true,
      publicId: 'abc',
      redirectUrl: 'https://pay.example/x'
    })
  })

  it('treats a 201 with a malformed body as payments unavailable', async () => {
    expect(await createOrder(body, reply(201, {nope: 1}))).toEqual({
      ok: false,
      error: 'unavailable_payments'
    })
  })

  it('lists the unavailable lines on 409', async () => {
    const fetchFn = reply(409, {
      message: 'unavailable',
      issues: {lines: [{server: 'survival', slug: 'vip'}]}
    })
    expect(await createOrder(body, fetchFn)).toEqual({
      ok: false,
      error: 'unavailable',
      lines: [{server: 'survival', slug: 'vip'}]
    })
  })

  it('maps a failed captcha on 400 to turnstile', async () => {
    const result = await createOrder(body, reply(400, {message: 'turnstile_failed'}))
    expect(result).toEqual({ok: false, error: 'turnstile'})
  })

  it('maps any other 400 to invalid', async () => {
    const result = await createOrder(body, reply(400, {message: ['nick must be a string']}))
    expect(result).toEqual({ok: false, error: 'invalid'})
  })

  it('maps 429 to rate_limited', async () => {
    expect(await createOrder(body, reply(429, {}))).toEqual({ok: false, error: 'rate_limited'})
  })

  it.each([502, 500, 503])('maps %i to unavailable_payments', async status => {
    expect(await createOrder(body, reply(status, {message: 'payments_unavailable'}))).toEqual({
      ok: false,
      error: 'unavailable_payments'
    })
  })

  it('maps a network error to unavailable_payments', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('failed'))
    expect(await createOrder(body, fetchFn)).toEqual({ok: false, error: 'unavailable_payments'})
  })
})
