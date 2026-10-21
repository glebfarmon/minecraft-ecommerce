import type Stripe from 'stripe'

import type {PaymentEvent} from './payments-gateway'

const PAID = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])
const FAILED = new Set(['checkout.session.expired', 'checkout.session.async_payment_failed'])

/** Stripe event → what the orders module acts on. Card payments complete as `paid`; BLIK/P24 may complete `unpaid` and settle later. */
export function toPaymentEvent(event: Stripe.Event): PaymentEvent {
  const base = {eventId: event.id, type: event.type}
  if (!PAID.has(event.type) && !FAILED.has(event.type)) return {kind: 'ignored', ...base}
  const s = event.data.object as Stripe.Checkout.Session
  const orderId = s.metadata?.orderId ?? null
  if (FAILED.has(event.type)) return {kind: 'failed', ...base, sessionId: s.id, orderId}
  if (s.payment_status !== 'paid') return {kind: 'ignored', ...base}
  return {
    kind: 'paid',
    ...base,
    sessionId: s.id,
    orderId,
    paymentIntentId:
      typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null),
    amountTotal: s.amount_total ?? -1,
    currency: (s.currency ?? '').toUpperCase()
  }
}
