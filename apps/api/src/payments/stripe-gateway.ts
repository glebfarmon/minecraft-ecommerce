import Stripe from 'stripe'

import {toPaymentEvent} from './payment-events'
import {InvalidSignatureError, type PaymentsGateway, type SessionRequest} from './payments-gateway'

// Stripe requires at least 30 minutes; the extra minute absorbs clock skew and request latency.
const SESSION_TTL_S = 31 * 60

export class StripeGateway implements PaymentsGateway {
  readonly name = 'stripe'
  private readonly stripe: Stripe
  constructor(
    secretKey: string,
    private readonly webhookSecret: string
  ) {
    this.stripe = new Stripe(secretKey)
  }

  async createSession(req: SessionRequest) {
    // A one-off coupon per order: Stripe's amount_total then equals the order total.
    const coupon =
      req.discount &&
      (await this.stripe.coupons.create(
        {
          amount_off: req.discount.minor,
          currency: req.currency.toLowerCase(),
          duration: 'once',
          max_redemptions: 1,
          name: req.discount.code
        },
        {idempotencyKey: `coupon-${req.orderId}`}
      ))
    const s = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: req.email,
        locale: req.locale,
        metadata: {orderId: req.orderId},
        expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_S,
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        line_items: req.lines.map(l => ({
          quantity: l.quantity,
          price_data: {
            currency: req.currency.toLowerCase(),
            unit_amount: l.unitAmountMinor,
            product_data: {name: l.name}
          }
        })),
        ...(coupon && {discounts: [{coupon: coupon.id}]})
      },
      {idempotencyKey: `order-${req.orderId}`}
    )
    if (!s.url) throw new Error('Stripe returned a session without a URL')
    return {sessionId: s.id, url: s.url}
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature) throw new InvalidSignatureError('missing signature')
    try {
      return toPaymentEvent(
        this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
      )
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError)
        throw new InvalidSignatureError(error.message)
      throw error
    }
  }
}
