import {Module} from '@nestjs/common'

import {DELIVERY_QUEUE, NoopDeliveryQueue} from './delivery-queue'
import {DeliverySweeperService} from './delivery-sweeper.service'
import {DeliveryService} from './delivery.service'
import {GrantExpiryService} from './grant-expiry.service'
import {RCON_SENDER, RconClientSender} from './rcon-sender'

@Module({
  providers: [
    {provide: DELIVERY_QUEUE, useClass: NoopDeliveryQueue},
    {provide: RCON_SENDER, useClass: RconClientSender},
    DeliveryService,
    DeliverySweeperService,
    GrantExpiryService
  ],
  exports: [DELIVERY_QUEUE, DeliveryService, DeliverySweeperService, GrantExpiryService]
})
export class DeliveryModule {}
