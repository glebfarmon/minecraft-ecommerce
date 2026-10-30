import {Module} from '@nestjs/common'

import {DELIVERY_QUEUE, NoopDeliveryQueue} from './delivery-queue'

@Module({
  providers: [{provide: DELIVERY_QUEUE, useClass: NoopDeliveryQueue}],
  exports: [DELIVERY_QUEUE]
})
export class DeliveryModule {}
