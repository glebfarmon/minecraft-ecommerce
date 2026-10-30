import {Module} from '@nestjs/common'

import {BullmqDeliveryQueue} from './bullmq-delivery-queue'
import {DeliveryAlertService} from './delivery-alert.service'
import {DELIVERY_QUEUE} from './delivery-queue'
import {DeliverySweeperService} from './delivery-sweeper.service'
import {DeliveryService} from './delivery.service'
import {GrantExpiryService} from './grant-expiry.service'
import {RCON_SENDER, RconClientSender} from './rcon-sender'

@Module({
  providers: [
    BullmqDeliveryQueue,
    {provide: DELIVERY_QUEUE, useExisting: BullmqDeliveryQueue},
    {provide: RCON_SENDER, useClass: RconClientSender},
    DeliveryAlertService,
    DeliveryService,
    DeliverySweeperService,
    GrantExpiryService
  ],
  exports: [
    BullmqDeliveryQueue,
    DELIVERY_QUEUE,
    DeliveryAlertService,
    DeliveryService,
    DeliverySweeperService,
    GrantExpiryService
  ]
})
export class DeliveryModule {}
