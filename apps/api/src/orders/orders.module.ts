import {Module} from '@nestjs/common'

import {FakePaymentController} from '../payments/fake-payment.controller'
import {RatesModule} from '../rates/rates.module'
import {OrderRatesService} from './order-rates.service'
import {OrderStatsController, OrdersAdminController} from './orders-admin.controller'
import {OrdersAdminService} from './orders-admin.service'
import {OrdersStatsService} from './orders-stats.service'
import {OrdersController} from './orders.controller'
import {OrdersService} from './orders.service'
import {PaymentEventsService} from './payment-events.service'
import {TURNSTILE, createTurnstile} from './turnstile'
import {WebhookController} from './webhook.controller'

@Module({
  imports: [RatesModule],
  controllers: [
    OrdersController,
    OrdersAdminController,
    OrderStatsController,
    WebhookController,
    FakePaymentController
  ],
  providers: [
    OrdersService,
    OrdersAdminService,
    OrdersStatsService,
    PaymentEventsService,
    OrderRatesService,
    {provide: TURNSTILE, useFactory: () => createTurnstile(process.env)}
  ],
  exports: [TURNSTILE]
})
export class OrdersModule {}
