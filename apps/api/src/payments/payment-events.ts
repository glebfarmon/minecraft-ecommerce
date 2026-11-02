import type Stripe from 'stripe'

import type {PaymentEvent} from './payments-gateway'

const PAID = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])
const FAILED = new Set(['checkout.session.expired', 'checkout.session.async_payment_failed'])
/**
 * Stripe does not say which event announces an inquiry that escalates to a chargeback, so the
 * money leaving (`funds_withdrawn`, once, at the start) opens the dispute too; a repeat is
 * harmless (only a PAID or DELIVERED order moves to DISPUTED). `charge.dispute.updated` is
 * deliberately not used: it fires on every evidence change, and a late or retried one arriving
 * after a won close would find the order PAID or DELIVERED again and re-open the dispute.
 */
const DISPUTE_OPENING = new Set(['charge.dispute.created', 'charge.dispute.funds_withdrawn'])
/** Open chargeback statuses; a `funds_withdrawn` in any other (closed, unknown) opens nothing. */
const DISPUTE_OPEN = new Set(['needs_response', 'under_review'])

/** Stripe event → what the orders module acts on. Card payments complete as `paid`; BLIK/P24 may complete `unpaid` and settle later. */
export function toPaymentEvent(event: Stripe.Event): PaymentEvent {
  const base = {eventId: event.id, type: event.type}
  if (event.type === 'charge.refunded') {
    const c = event.data.object
    if (typeof c.payment_intent !== 'string' || c.amount_refunded !== c.amount)
      return {kind: 'ignored', ...base}
    return {kind: 'refunded', ...base, paymentIntentId: c.payment_intent}
  }
  if (DISPUTE_OPENING.has(event.type) || event.type === 'charge.dispute.closed') {
    const d = (event as Stripe.ChargeDisputeCreatedEvent).data.object
    if (typeof d.payment_intent !== 'string') return {kind: 'ignored', ...base}
    if (event.type === 'charge.dispute.closed') {
      // Only a decided dispute moves money; warning_closed, charge_refunded and unknowns do not.
      if (d.status !== 'won' && d.status !== 'lost') return {kind: 'ignored', ...base}
      return {
        kind: 'dispute_closed',
        ...base,
        paymentIntentId: d.payment_intent,
        disputeId: d.id,
        won: d.status === 'won'
      }
    }
    // Inquiries (warning_*) are not chargebacks: no money was taken.
    if (d.status.startsWith('warning_')) return {kind: 'ignored', ...base}
    if (event.type !== 'charge.dispute.created' && !DISPUTE_OPEN.has(d.status))
      return {kind: 'ignored', ...base}
    return {
      kind: 'dispute_opened',
      ...base,
      paymentIntentId: d.payment_intent,
      disputeId: d.id,
      amount: d.amount,
      currency: d.currency.toUpperCase()
    }
  }
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
