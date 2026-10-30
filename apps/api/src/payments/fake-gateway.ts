import {randomBytes} from 'node:crypto'

import Stripe from 'stripe'

import {toPaymentEvent} from './payment-events'
import {InvalidSignatureError, type PaymentsGateway, type SessionRequest} from './payments-gateway'

type FakeSession = SessionRequest & {id: string}

/** What the buyer pays: the lines minus the discount, as Stripe computes `amount_total`. */
export const sessionTotal = (s: SessionRequest) =>
  s.lines.reduce((sum, l) => sum + l.unitAmountMinor * l.quantity, 0) - (s.discount?.minor ?? 0)

/** e2e only: a "payment page" on the API that signs Stripe-shaped webhooks with the real secret. */
export class FakeGateway implements PaymentsGateway {
  readonly name = 'fake'
  private readonly sessions = new Map<string, FakeSession>()
  private readonly refunds = new Map<string, {paymentIntentId: string; refundId: string}>()
  readonly refundCalls: {paymentIntentId: string; idempotencyKey: string; refundId: string}[] = []
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
          amount_total: sessionTotal(s),
          currency: s.currency.toLowerCase(),
          payment_status: paid ? 'paid' : 'unpaid',
          payment_intent: paid ? `pi_fake_${randomBytes(12).toString('hex')}` : null
        }
      }
    })
    return {
      body: payload,
      signature: Stripe.webhooks.generateTestHeaderString({payload, secret: this.webhookSecret})
    }
  }

  /** Records the call; a repeated key returns the same refund id. */
  refund(paymentIntentId: string, idempotencyKey: string) {
    const known = this.refunds.get(idempotencyKey)
    if (known && known.paymentIntentId !== paymentIntentId)
      throw new Error(`idempotency key ${idempotencyKey} was used for another payment`)
    const refundId = known?.refundId ?? `re_fake_${randomBytes(12).toString('hex')}`
    this.refunds.set(idempotencyKey, {paymentIntentId, refundId})
    this.refundCalls.push({paymentIntentId, idempotencyKey, refundId})
    return Promise.resolve({refundId})
  }

  /** e2e hook: a signed Stripe-shaped refund or dispute event for a payment. */
  signedChargeEvent(
    kind: 'refunded' | 'dispute_opened' | 'dispute_won' | 'dispute_lost',
    paymentIntentId: string,
    amount: number,
    currency: string
  ) {
    const rand = randomBytes(12).toString('hex')
    const refunded = kind === 'refunded'
    const type = refunded
      ? 'charge.refunded'
      : kind === 'dispute_opened'
        ? 'charge.dispute.created'
        : 'charge.dispute.closed'
    const object = refunded
      ? {
          id: `ch_fake_${rand}`,
          object: 'charge',
          payment_intent: paymentIntentId,
          amount,
          amount_refunded: amount,
          currency: currency.toLowerCase()
        }
      : {
          id: `dp_fake_${rand}`,
          object: 'dispute',
          payment_intent: paymentIntentId,
          amount,
          currency: currency.toLowerCase(),
          status:
            kind === 'dispute_opened' ? 'needs_response' : kind === 'dispute_won' ? 'won' : 'lost'
        }
    const payload = JSON.stringify({
      id: `evt_fake_${randomBytes(12).toString('hex')}`,
      object: 'event',
      type,
      data: {object}
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
      if (error instanceof Stripe.errors.StripeSignatureVerificationError)
        throw new InvalidSignatureError(error.message)
      throw error
    }
  }
}
