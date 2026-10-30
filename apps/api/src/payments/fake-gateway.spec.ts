import {FakeGateway} from './fake-gateway'
import {InvalidSignatureError} from './payments-gateway'

const req = {
  orderId: 'o1',
  currency: 'EUR' as const,
  email: 'a@b.co',
  locale: 'en' as const,
  lines: [{name: 'VIP', unitAmountMinor: 499, quantity: 2}],
  successUrl: 'http://w/ok',
  cancelUrl: 'http://w/',
  discount: null
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
  it('charges the discounted total', async () => {
    const s = await gw.createSession({...req, discount: {minor: 100, code: 'ASF14'}})
    expect(gw.session(s.sessionId)?.discount).toEqual({minor: 100, code: 'ASF14'})
    const {body, signature} = gw.signedEvent(s.sessionId, 'checkout.session.completed')
    expect(gw.parseWebhook(Buffer.from(body), signature)).toMatchObject({
      kind: 'paid',
      amountTotal: 898
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
  it('returns one refund id per idempotency key', async () => {
    const a = await gw.refund('pi_1', 'k1')
    expect(a.refundId).toMatch(/^re_fake_/)
    expect(await gw.refund('pi_1', 'k1')).toEqual(a)
    expect((await gw.refund('pi_1', 'k2')).refundId).not.toBe(a.refundId)
    expect(gw.refundCalls.filter(c => c.idempotencyKey === 'k1')).toEqual([
      {paymentIntentId: 'pi_1', idempotencyKey: 'k1', refundId: a.refundId},
      {paymentIntentId: 'pi_1', idempotencyKey: 'k1', refundId: a.refundId}
    ])
  })
  it('refuses a reused refund key for another payment', async () => {
    await gw.refund('pi_a', 'k-reuse')
    expect(() => gw.refund('pi_b', 'k-reuse')).toThrow('another payment')
  })
  it.each([
    ['refunded', {kind: 'refunded', paymentIntentId: 'pi_9'}],
    [
      'dispute_opened',
      {kind: 'dispute_opened', paymentIntentId: 'pi_9', amount: 500, currency: 'EUR'}
    ],
    ['dispute_won', {kind: 'dispute_closed', paymentIntentId: 'pi_9', won: true}],
    ['dispute_lost', {kind: 'dispute_closed', paymentIntentId: 'pi_9', won: false}]
  ] as const)('signs a %s charge event its own parser accepts', (kind, expected) => {
    const {body, signature} = gw.signedChargeEvent(kind, 'pi_9', 500, 'EUR')
    expect(gw.parseWebhook(Buffer.from(body), signature)).toMatchObject(expected)
  })
})
