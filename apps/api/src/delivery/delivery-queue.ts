import {Injectable} from '@nestjs/common'

export interface DeliveryQueue {
  enqueue(deliveryId: string, delayMs?: number): Promise<void>
}

export const DELIVERY_QUEUE = Symbol('DELIVERY_QUEUE')

/** For unit tests only: the app binds `DELIVERY_QUEUE` to `BullmqDeliveryQueue`. */
@Injectable()
export class NoopDeliveryQueue implements DeliveryQueue {
  enqueue(): Promise<void> {
    return Promise.resolve()
  }
}
