import {randomBytes} from 'node:crypto'

import Stripe from 'stripe'

import {toPaymentEvent} from './payment-events'
import {InvalidSignatureError, type PaymentsGateway, type SessionRequest} from './payments-gateway'

type FakeSession = SessionRequest & {id: string}

/** e2e only: a "payment page" on the API that signs Stripe-shaped webhooks with the real secret. */
export class FakeGateway implements PaymentsGateway {
  readonly name = 'fake'
  private readonly sessions = new Map<string, FakeSession>()
  constructor(
    private readonly webhookSecret: string,
    private readonly publicOrigin: string
  ) {}

  createSession(req: SessionRequest) {
    const id = `cs_fake_${randomBytes(12).toString('hex')}`
    this.sessions.set(id, {...req, id})
    return Promise.resolve({sessionId: id, url: `${this.publicOrigin}/api/payments/fake/${id}`})
  }

  session(id: string) {
    return this.sessions.get(id)
  }

  signedEvent(id: string, type: 'checkout.session.completed' | 'checkout.session.expired') {
    const s = this.sessions.get(id)
    if (!s) throw new Error(`unknown fake session ${id}`)
    const paid = type === 'checkout.session.completed'
    const payload = JSON.stringify({
      id: `evt_fake_${randomBytes(12).toString('hex')}`,
      object: 'event',
      type,
      data: {
        object: {
          id: s.id,
          object: 'checkout.session',
          metadata: {orderId: s.orderId},
          amount_total: s.lines.reduce((sum, l) => sum + l.unitAmountMinor * l.quantity, 0),
          currency: s.currency.toLowerCase(),
          payment_status: paid ? 'paid' : 'unpaid'
        }
      }
    })
    return {
      body: payload,
      signature: Stripe.webhooks.generateTestHeaderString({payload, secret: this.webhookSecret})
    }
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature) throw new InvalidSignatureError('missing signature')
    try {
      return toPaymentEvent(Stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret))
    } catch (error) {
      throw new InvalidSignatureError(error instanceof Error ? error.message : 'invalid signature')
    }
  }
}
