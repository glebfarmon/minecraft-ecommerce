import {Controller, Get, Header, Inject, Param, Post, Res} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import {notFound} from '../common/http-errors'
import {PaymentEventsService} from '../orders/payment-events.service'
import {FakeGateway} from './fake-gateway'
import {fakePaymentPage} from './fake-payment-page'
import {PAYMENTS_GATEWAY, type PaymentsGateway} from './payments-gateway'

/** The slice of Express's response used here (express itself is not a direct dependency). */
type Redirector = {redirect(status: number, url: string): void}

/** e2e only: answers 404 unless the fake gateway is the active one. */
@AllowAnonymous()
@Controller('payments/fake')
export class FakePaymentController {
  constructor(
    @Inject(PAYMENTS_GATEWAY) private readonly gateway: PaymentsGateway,
    private readonly events: PaymentEventsService
  ) {}

  private fake(id: string) {
    if (!(this.gateway instanceof FakeGateway)) throw notFound()
    const session = this.gateway.session(id)
    if (!session) throw notFound()
    return {gateway: this.gateway, session}
  }

  @Get(':id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  page(@Param('id') id: string) {
    return fakePaymentPage(this.fake(id).session)
  }

  @Post(':id/pay')
  async pay(@Param('id') id: string, @Res() res: Redirector) {
    const {gateway, session} = this.fake(id)
    const {body, signature} = gateway.signedEvent(id, 'checkout.session.completed')
    await this.events.apply(gateway.parseWebhook(Buffer.from(body), signature))
    res.redirect(303, session.successUrl)
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Res() res: Redirector) {
    res.redirect(303, this.fake(id).session.cancelUrl)
  }
}
