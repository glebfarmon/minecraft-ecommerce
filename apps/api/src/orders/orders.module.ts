import {Module} from '@nestjs/common'

import {FakePaymentController} from '../payments/fake-payment.controller'
import {OrdersAdminController} from './orders-admin.controller'
import {OrdersAdminService} from './orders-admin.service'
import {OrdersController} from './orders.controller'
import {OrdersService} from './orders.service'
import {PaymentEventsService} from './payment-events.service'
import {TURNSTILE, createTurnstile} from './turnstile'
import {WebhookController} from './webhook.controller'

@Module({
  controllers: [OrdersController, OrdersAdminController, WebhookController, FakePaymentController],
  providers: [
    OrdersService,
    OrdersAdminService,
    PaymentEventsService,
    {provide: TURNSTILE, useFactory: () => createTurnstile(process.env)}
  ],
  exports: [TURNSTILE]
})
export class OrdersModule {}
