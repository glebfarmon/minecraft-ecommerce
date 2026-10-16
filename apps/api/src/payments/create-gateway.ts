import {FakeGateway} from './fake-gateway'
import type {PaymentsGateway} from './payments-gateway'
import {StripeGateway} from './stripe-gateway'

/**
 * `PAYMENTS_GATEWAY`: `stripe` or `fake` (default `fake` outside production). Production refuses
 * the fake unless `PAYMENTS_ALLOW_FAKE=true` (the e2e image runs with NODE_ENV=production).
 */
export function createPaymentsGateway(env: Partial<Record<string, string>>): PaymentsGateway {
  const prod = env.NODE_ENV === 'production'
  const kind = env.PAYMENTS_GATEWAY ?? (prod ? undefined : 'fake')
  if (kind === 'stripe') {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)
      throw new Error(
        'STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set for PAYMENTS_GATEWAY=stripe'
      )
    return new StripeGateway(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET)
  }
  if (kind === 'fake') {
    if (prod && env.PAYMENTS_ALLOW_FAKE !== 'true')
      throw new Error(
        'PAYMENTS_GATEWAY=fake in production needs PAYMENTS_ALLOW_FAKE=true (e2e only)'
      )
    return new FakeGateway(
      env.STRIPE_WEBHOOK_SECRET ?? 'whsec_local_fake',
      env.PUBLIC_WEB_ORIGIN ?? 'http://shop.localhost'
    )
  }
  throw new Error(`PAYMENTS_GATEWAY must be "stripe" or "fake", got "${String(kind)}"`)
}
