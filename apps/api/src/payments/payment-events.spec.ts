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
  describe('charge events', () => {
    const charge = (over: object) => ({
      amount: 500,
      amount_refunded: 500,
      payment_intent: 'pi_1',
      ...over
    })
    const dispute = (over: object) => ({
      id: 'dp_1',
      payment_intent: 'pi_1',
      amount: 500,
      currency: 'eur',
      status: 'needs_response',
      ...over
    })
    it('maps a full refund', () => {
      expect(toPaymentEvent(event('charge.refunded', charge({})))).toEqual({
        kind: 'refunded',
        eventId: 'evt_1',
        type: 'charge.refunded',
        paymentIntentId: 'pi_1'
      })
    })
    it('ignores a partial refund or a charge without a payment intent', () => {
      expect(toPaymentEvent(event('charge.refunded', charge({amount_refunded: 100}))).kind).toBe(
        'ignored'
      )
      expect(toPaymentEvent(event('charge.refunded', charge({payment_intent: null}))).kind).toBe(
        'ignored'
      )
    })
    it('maps an opened dispute', () => {
      expect(toPaymentEvent(event('charge.dispute.created', dispute({})))).toEqual({
        kind: 'dispute_opened',
        eventId: 'evt_1',
        type: 'charge.dispute.created',
        paymentIntentId: 'pi_1',
        disputeId: 'dp_1',
        amount: 500,
        currency: 'EUR'
      })
      expect(
        toPaymentEvent(event('charge.dispute.created', dispute({payment_intent: null}))).kind
      ).toBe('ignored')
    })
    it('ignores an inquiry opening (warning_* statuses)', () => {
      for (const status of ['warning_needs_response', 'warning_under_review'])
        expect(toPaymentEvent(event('charge.dispute.created', dispute({status}))).kind).toBe(
          'ignored'
        )
      for (const status of ['needs_response', 'under_review'])
        expect(toPaymentEvent(event('charge.dispute.created', dispute({status}))).kind).toBe(
          'dispute_opened'
        )
    })
    it('maps funds_withdrawn of an open chargeback as an opened dispute', () => {
      const type = 'charge.dispute.funds_withdrawn'
      expect(toPaymentEvent(event(type, dispute({})))).toEqual({
        kind: 'dispute_opened',
        eventId: 'evt_1',
        type,
        paymentIntentId: 'pi_1',
        disputeId: 'dp_1',
        amount: 500,
        currency: 'EUR'
      })
      expect(toPaymentEvent(event(type, dispute({status: 'under_review'}))).kind).toBe(
        'dispute_opened'
      )
      for (const status of [
        'won',
        'lost',
        'charge_refunded',
        'warning_closed',
        'warning_needs_response',
        'something_new'
      ])
        expect(toPaymentEvent(event(type, dispute({status}))).kind).toBe('ignored')
      expect(toPaymentEvent(event(type, dispute({payment_intent: null}))).kind).toBe('ignored')
    })
    it('ignores charge.dispute.updated: a late replay would re-open a won dispute', () => {
      for (const status of ['needs_response', 'under_review', 'won'])
        expect(toPaymentEvent(event('charge.dispute.updated', dispute({status}))).kind).toBe(
          'ignored'
        )
    })
    it('ignores closings that are neither won nor lost', () => {
      for (const status of ['warning_closed', 'charge_refunded', 'something_new'])
        expect(toPaymentEvent(event('charge.dispute.closed', dispute({status}))).kind).toBe(
          'ignored'
        )
    })
    it('ignores an expanded payment_intent object', () => {
      expect(
        toPaymentEvent(event('charge.refunded', charge({payment_intent: {id: 'pi_1'}}))).kind
      ).toBe('ignored')
      expect(
        toPaymentEvent(event('charge.dispute.created', dispute({payment_intent: {id: 'pi_1'}})))
          .kind
      ).toBe('ignored')
    })
    it('maps a closed dispute, won only for status won', () => {
      expect(
        toPaymentEvent(event('charge.dispute.closed', dispute({status: 'won'})))
      ).toMatchObject({
        kind: 'dispute_closed',
        paymentIntentId: 'pi_1',
        disputeId: 'dp_1',
        won: true
      })
      expect(
        toPaymentEvent(event('charge.dispute.closed', dispute({status: 'lost'})))
      ).toMatchObject({kind: 'dispute_closed', won: false})
      expect(
        toPaymentEvent(event('charge.dispute.closed', dispute({payment_intent: null}))).kind
      ).toBe('ignored')
    })
  })
})
