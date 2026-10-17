import {StripeGateway} from './stripe-gateway'

type Create = jest.Mock<
  Promise<{id: string; url: string | null}>,
  [Record<string, unknown>, unknown]
>

function gatewayWith(create: Create) {
  const gateway = new StripeGateway('sk_test_x', 'whsec_x')
  ;(gateway as unknown as {stripe: unknown}).stripe = {checkout: {sessions: {create}}}
  return gateway
}

const request = {
  orderId: 'ord1',
  currency: 'PLN' as const,
  email: 'steve@example.com',
  locale: 'pl' as const,
  lines: [
    {name: 'VIP', unitAmountMinor: 1999, quantity: 2},
    {name: 'Coins', unitAmountMinor: 500, quantity: 1}
  ],
  successUrl: 'https://shop.example.com/orders/ord1',
  cancelUrl: 'https://shop.example.com/checkout'
}

describe('StripeGateway.createSession', () => {
  it('creates a payment-mode session with the order data', async () => {
    const create: Create = jest.fn().mockResolvedValue({id: 'cs_1', url: 'https://pay/cs_1'})
    const before = Math.floor(Date.now() / 1000)
    const result = await gatewayWith(create).createSession(request)
    expect(result).toEqual({sessionId: 'cs_1', url: 'https://pay/cs_1'})

    const [params, options] = create.mock.calls[0] ?? []
    expect(params).toMatchObject({
      mode: 'payment',
      customer_email: 'steve@example.com',
      locale: 'pl',
      metadata: {orderId: 'ord1'},
      success_url: request.successUrl,
      cancel_url: request.cancelUrl
    })
    expect(params).not.toHaveProperty('payment_method_types')
    expect(params?.line_items).toEqual([
      {
        quantity: 2,
        price_data: {currency: 'pln', unit_amount: 1999, product_data: {name: 'VIP'}}
      },
      {
        quantity: 1,
        price_data: {currency: 'pln', unit_amount: 500, product_data: {name: 'Coins'}}
      }
    ])
    // Stripe: at least 30 minutes (on its clock), at most 24 hours
    const expiresAt = params?.expires_at as number
    expect(expiresAt).toBeGreaterThanOrEqual(before + 30 * 60 + 30)
    expect(expiresAt).toBeLessThanOrEqual(before + 24 * 60 * 60)
    expect(options).toEqual({idempotencyKey: 'order-ord1'})
  })

  it('throws when Stripe returns a session without a URL', async () => {
    const create: Create = jest.fn().mockResolvedValue({id: 'cs_2', url: null})
    await expect(gatewayWith(create).createSession(request)).rejects.toThrow(/without a URL/)
  })
})
