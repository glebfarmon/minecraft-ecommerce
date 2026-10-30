import {Module} from '@nestjs/common'

import {DeliveryModule} from '../delivery/delivery.module'
import {FakePaymentController} from '../payments/fake-payment.controller'
import {RatesModule} from '../rates/rates.module'
import {OrderRatesService} from './order-rates.service'
import {OrderStatsController, OrdersAdminController} from './orders-admin.controller'
import {OrdersAdminService} from './orders-admin.service'
import {OrdersStatsService} from './orders-stats.service'
import {OrdersController} from './orders.controller'
import {OrdersService} from './orders.service'
import {PaymentEventsService} from './payment-events.service'
import {PromoAdminController} from './promo/promo-admin.controller'
import {PromoAdminService} from './promo/promo-admin.service'
import {PromoController} from './promo/promo.controller'
import {PromoService} from './promo/promo.service'
import {TURNSTILE, createTurnstile} from './turnstile'
import {WebhookController} from './webhook.controller'

@Module({
  imports: [RatesModule, DeliveryModule],
  controllers: [
    OrdersController,
    OrdersAdminController,
    OrderStatsController,
    WebhookController,
    FakePaymentController,
    PromoController,
    PromoAdminController
  ],
  providers: [
    OrdersService,
    PromoService,
    PromoAdminService,
    OrdersAdminService,
    OrdersStatsService,
    PaymentEventsService,
    OrderRatesService,
    {provide: TURNSTILE, useFactory: () => createTurnstile(process.env)}
  ],
  exports: [TURNSTILE]
})
export class OrdersModule {}
