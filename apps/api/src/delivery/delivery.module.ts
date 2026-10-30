import {Module} from '@nestjs/common'

import {DELIVERY_QUEUE, NoopDeliveryQueue} from './delivery-queue'
import {DeliveryService} from './delivery.service'
import {RCON_SENDER, RconClientSender} from './rcon-sender'

@Module({
  providers: [
    {provide: DELIVERY_QUEUE, useClass: NoopDeliveryQueue},
    {provide: RCON_SENDER, useClass: RconClientSender},
    DeliveryService
  ],
  exports: [DELIVERY_QUEUE, DeliveryService]
})
export class DeliveryModule {}
