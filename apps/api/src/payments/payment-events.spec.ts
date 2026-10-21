import type Stripe from 'stripe'

import {toPaymentEvent} from './payment-events'

const session = (over: Partial<Stripe.Checkout.Session>) =>
  ({
    id: 'cs_1',
    metadata: {orderId: 'o1'},
    amount_total: 499,
    currency: 'eur',
    payment_status: 'paid',
    ...over
  }) as Stripe.Checkout.Session
const event = (type: string, obj: object) =>
  ({id: 'evt_1', type, data: {object: obj}}) as unknown as Stripe.Event

describe('toPaymentEvent', () => {
  it('maps a paid completed session', () => {
    expect(toPaymentEvent(event('checkout.session.completed', session({})))).toEqual({
      kind: 'paid',
      eventId: 'evt_1',
      type: 'checkout.session.completed',
      sessionId: 'cs_1',
      orderId: 'o1',
      paymentIntentId: null,
      amountTotal: 499,
      currency: 'EUR'
    })
  })
  it('ignores a completed session that is not paid yet (async methods)', () => {
    expect(
      toPaymentEvent(event('checkout.session.completed', session({payment_status: 'unpaid'}))).kind
    ).toBe('ignored')
  })
  it('maps async success to paid', () => {
    expect(
      toPaymentEvent(event('checkout.session.async_payment_succeeded', session({}))).kind
    ).toBe('paid')
  })
  it.each(['checkout.session.expired', 'checkout.session.async_payment_failed'])(
    'maps %s to failed',
    type => {
      expect(toPaymentEvent(event(type, session({payment_status: 'unpaid'})))).toEqual({
        kind: 'failed',
        eventId: 'evt_1',
        type,
        sessionId: 'cs_1',
        orderId: 'o1'
      })
    }
  )
  it('ignores other types', () => {
    expect(toPaymentEvent(event('charge.succeeded', {})).kind).toBe('ignored')
  })
  it('carries the payment intent id, expanded or not', () => {
    const plain = toPaymentEvent(
      event('checkout.session.completed', session({payment_intent: 'pi_1'}))
    )
    expect(plain).toMatchObject({kind: 'paid', paymentIntentId: 'pi_1'})
    const expanded = toPaymentEvent(
      event(
        'checkout.session.completed',
        session({payment_intent: {id: 'pi_2'} as Stripe.PaymentIntent})
      )
    )
    expect(expanded).toMatchObject({kind: 'paid', paymentIntentId: 'pi_2'})
  })
  it('keeps a missing orderId as null', () => {
    const e = toPaymentEvent(event('checkout.session.completed', session({metadata: {}})))
    expect(e).toMatchObject({kind: 'paid', orderId: null})
  })
})
