import {fakePaymentPage} from './fake-payment-page'

const session = {
  id: 'cs_fake_1',
  orderId: 'o1',
  currency: 'EUR' as const,
  email: 'a@b.co',
  locale: 'en' as const,
  lines: [{name: 'VIP', unitAmountMinor: 499, quantity: 2}],
  successUrl: 'http://w/ok',
  cancelUrl: 'http://w/',
  discount: null
}

describe('fakePaymentPage', () => {
  it('shows the full total and no discount row without a discount', () => {
    const html = fakePaymentPage(session)
    expect(html).toContain('Total: €9.98')
    expect(html).not.toContain('Discount')
  })

  it('shows the discount row and charges the discounted total', () => {
    const html = fakePaymentPage({...session, discount: {minor: 100, code: 'ASF14'}})
    expect(html).toContain('Discount (ASF14): &minus;€1.00')
    expect(html).toContain('Total: €8.98')
  })
})
