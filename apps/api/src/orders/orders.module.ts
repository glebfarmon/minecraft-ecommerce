import {Module} from '@nestjs/common'

import {OrdersController} from './orders.controller'
import {OrdersService} from './orders.service'
import {PaymentEventsService} from './payment-events.service'
import {TURNSTILE, createTurnstile} from './turnstile'
import {WebhookController} from './webhook.controller'

@Module({
  controllers: [OrdersController, WebhookController],
  providers: [
    OrdersService,
    PaymentEventsService,
    {provide: TURNSTILE, useFactory: () => createTurnstile(process.env)}
  ],
  exports: [TURNSTILE]
})
export class OrdersModule {}
