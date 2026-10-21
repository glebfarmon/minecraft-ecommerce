import {FakeGateway} from './fake-gateway'
import {InvalidSignatureError} from './payments-gateway'

const req = {
  orderId: 'o1',
  currency: 'EUR' as const,
  email: 'a@b.co',
  locale: 'en' as const,
  lines: [{name: 'VIP', unitAmountMinor: 499, quantity: 2}],
  successUrl: 'http://w/ok',
  cancelUrl: 'http://w/'
}

describe('FakeGateway', () => {
  const gw = new FakeGateway('whsec_test', 'http://shop.test')
  it('returns a pay page URL on the API', async () => {
    const s = await gw.createSession(req)
    expect(s.url).toBe(`http://shop.test/api/payments/fake/${s.sessionId}`)
    expect(gw.session(s.sessionId)?.orderId).toBe('o1')
  })
  it('signs a completed event its own parser accepts, with the session total', async () => {
    const s = await gw.createSession(req)
    const {body, signature} = gw.signedEvent(s.sessionId, 'checkout.session.completed')
    expect(gw.parseWebhook(Buffer.from(body), signature)).toMatchObject({
      kind: 'paid',
      orderId: 'o1',
      amountTotal: 998,
      currency: 'EUR',
      sessionId: s.sessionId,
      paymentIntentId: expect.stringMatching(/^pi_fake_/) as unknown
    })
  })
  it('rejects a tampered body', async () => {
    const s = await gw.createSession(req)
    const {body, signature} = gw.signedEvent(s.sessionId, 'checkout.session.completed')
    expect(() => gw.parseWebhook(Buffer.from(body.replace('998', '1')), signature)).toThrow(
      InvalidSignatureError
    )
  })
  it('rejects a missing signature', () => {
    expect(() => gw.parseWebhook(Buffer.from('{}'), undefined)).toThrow(InvalidSignatureError)
  })
})
