import type {IncomingMessage} from 'node:http'

import {Controller, Headers, HttpCode, Inject, Post, Req} from '@nestjs/common'
import {SkipThrottle} from '@nestjs/throttler'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import {badRequest} from '../common/http-errors'
import {
  InvalidSignatureError,
  PAYMENTS_GATEWAY,
  type PaymentEvent,
  type PaymentsGateway
} from '../payments/payments-gateway'
import {PaymentEventsService} from './payment-events.service'

/**
 * Stripe webhooks. Authenticated by the signature over the raw body (`req.rawBody`, attached by
 * the auth module's JSON parser). Stripe retries bursts, so the per-IP `default` limit is off; the
 * other throttlers only match admin and order-creation paths.
 */
@AllowAnonymous()
@SkipThrottle({default: true})
@Controller('webhooks')
export class WebhookController {
  constructor(
    @Inject(PAYMENTS_GATEWAY) private readonly gateway: PaymentsGateway,
    private readonly events: PaymentEventsService
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async stripe(
    @Req() req: IncomingMessage & {rawBody?: Buffer},
    @Headers('stripe-signature') signature?: string
  ): Promise<{received: true}> {
    if (!req.rawBody) throw badRequest('invalid_signature')
    let event: PaymentEvent
    try {
      event = this.gateway.parseWebhook(req.rawBody, signature)
    } catch (error) {
      if (error instanceof InvalidSignatureError) throw badRequest('invalid_signature')
      throw error
    }
    await this.events.apply(event)
    return {received: true}
  }
}
