export type SessionLine = {name: string; unitAmountMinor: number; quantity: number}
export type SessionRequest = {
  orderId: string
  currency: 'EUR' | 'PLN'
  email: string
  locale: 'en' | 'pl'
  lines: SessionLine[]
  successUrl: string
  cancelUrl: string
  /** A promo discount off the whole order; the lines keep their full unit prices. */
  discount: {minor: number; code: string} | null
}
export type PaymentEvent =
  | {
      kind: 'paid'
      eventId: string
      type: string
      sessionId: string
      orderId: string | null
      /** The Stripe payment (`pi_…`); null when Stripe sent none. */
      paymentIntentId: string | null
      amountTotal: number
      currency: string
    }
  | {kind: 'failed'; eventId: string; type: string; sessionId: string; orderId: string | null}
  /** A full refund of the payment (`charge.refunded` with everything returned). */
  | {kind: 'refunded'; eventId: string; type: string; paymentIntentId: string}
  | {
      kind: 'dispute_opened'
      eventId: string
      type: string
      paymentIntentId: string
      disputeId: string
      amount: number
      currency: string
    }
  | {
      kind: 'dispute_closed'
      eventId: string
      type: string
      paymentIntentId: string
      disputeId: string
      won: boolean
    }
  | {kind: 'ignored'; eventId: string; type: string}

export interface PaymentsGateway {
  readonly name: 'stripe' | 'fake'
  createSession(req: SessionRequest): Promise<{sessionId: string; url: string}>
  /** Refunds the whole payment; the same key never refunds twice. */
  refund(paymentIntentId: string, idempotencyKey: string): Promise<{refundId: string}>
  /** Throws `InvalidSignatureError` when the signature does not match. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent
}

export const PAYMENTS_GATEWAY = Symbol('PAYMENTS_GATEWAY')

export class InvalidSignatureError extends Error {}
