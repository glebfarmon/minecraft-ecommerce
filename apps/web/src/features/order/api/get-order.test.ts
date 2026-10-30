/** @jest-environment node */
import {getOrder} from './get-order'

const order = {
  publicId: 'ABCDEFGHJK',
  status: 'PAID',
  nick: 'Steve',
  email: 'a***@example.com',
  currency: 'EUR',
  subtotalMinor: 500,
  discountMinor: 0,
  promoCode: null,
  totalMinor: 500,
  servers: [
    {serverName: 'Survival', items: [{productName: 'VIP', quantity: 1, unitAmountMinor: 500}]}
  ],
  createdAt: '2026-10-16T10:00:00.000Z',
  paidAt: '2026-10-16T10:01:00.000Z',
  delivery: 'none'
}

const mockFetch = (status: number, body: unknown = order) => {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  })
  global.fetch = fn
  return fn
}

describe('getOrder', () => {
  it('parses a 200', async () => {
    mockFetch(200)
    await expect(getOrder('ABCDEFGHJK')).resolves.toMatchObject({publicId: 'ABCDEFGHJK'})
  })
  it('returns null on 404', async () => {
    mockFetch(404, {})
    await expect(getOrder('ABCDEFGHJK')).resolves.toBeNull()
  })
  it('throws on 500', async () => {
    mockFetch(500, {})
    await expect(getOrder('ABCDEFGHJK')).rejects.toThrow()
  })
  it('never caches', async () => {
    const fn = mockFetch(200)
    await getOrder('ABCDEFGHJK')
    expect(fn).toHaveBeenCalledWith(
      'http://localhost:4000/api/orders/ABCDEFGHJK',
      expect.objectContaining({cache: 'no-store'})
    )
  })
})
