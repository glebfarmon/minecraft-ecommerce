import {getMailer} from '../../src/mailer/create-mailer'
import type {MemoryMailer} from '../../src/mailer/memory-mailer'
import {TURNSTILE, type TurnstileVerifier} from '../../src/orders/turnstile'
import type {FakeGateway} from '../../src/payments/fake-gateway'
import {PAYMENTS_GATEWAY} from '../../src/payments/payments-gateway'
import {startCatalogApp} from './catalog-app'

/** The catalog app plus the fake payments gateway; read by `createApp()`, so set before it. */
export async function startOrdersApp() {
  process.env.PAYMENTS_GATEWAY = 'fake'
  process.env.EXCHANGE_RATES = 'fixed'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_int'
  process.env.PUBLIC_WEB_ORIGIN = 'http://shop.test'
  const ctx = await startCatalogApp()
  return {
    ...ctx,
    gateway: ctx.app.get<FakeGateway>(PAYMENTS_GATEWAY),
    turnstile: ctx.app.get<TurnstileVerifier>(TURNSTILE),
    mailer: getMailer() as MemoryMailer
  }
}
