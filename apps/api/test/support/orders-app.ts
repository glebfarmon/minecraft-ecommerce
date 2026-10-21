import {randomBytes} from 'node:crypto'

import {getMailer} from '../../src/mailer/create-mailer'
import type {MemoryMailer} from '../../src/mailer/memory-mailer'
import {TURNSTILE, type TurnstileVerifier} from '../../src/orders/turnstile'
import type {FakeGateway} from '../../src/payments/fake-gateway'
import {PAYMENTS_GATEWAY} from '../../src/payments/payments-gateway'
import {seedDemoRcon} from '../../src/seed/seed-rcon'
import {startCatalogApp} from './catalog-app'

/** The catalog app plus the fake payments gateway; read by `createApp()`, so set before it. */
export async function startOrdersApp() {
  process.env.PAYMENTS_GATEWAY = 'fake'
  process.env.EXCHANGE_RATES = 'fixed'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_int'
  process.env.PUBLIC_WEB_ORIGIN = 'http://shop.test'
  process.env.RCON_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const ctx = await startCatalogApp()
  // Servers without RCON refuse every purchase; the demo ones get an endpoint like the e2e stack does.
  await seedDemoRcon(ctx.prisma, {
    ...process.env,
    SEED_RCON_HOST: '127.0.0.1',
    SEED_RCON_PORT: '25575',
    SEED_RCON_PASSWORD: 'int-test'
  })
  return {
    ...ctx,
    gateway: ctx.app.get<FakeGateway>(PAYMENTS_GATEWAY),
    turnstile: ctx.app.get<TurnstileVerifier>(TURNSTILE),
    mailer: getMailer() as MemoryMailer
  }
}
