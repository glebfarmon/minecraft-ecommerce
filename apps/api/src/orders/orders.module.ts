import {Module} from '@nestjs/common'

import {OrdersController} from './orders.controller'
import {OrdersService} from './orders.service'
import {TURNSTILE, createTurnstile} from './turnstile'

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, {provide: TURNSTILE, useFactory: () => createTurnstile(process.env)}],
  exports: [TURNSTILE]
})
export class OrdersModule {}
