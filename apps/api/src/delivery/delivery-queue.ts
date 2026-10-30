import {Injectable} from '@nestjs/common'

export interface DeliveryQueue {
  enqueue(deliveryId: string, delayMs?: number): Promise<void>
}

export const DELIVERY_QUEUE = Symbol('DELIVERY_QUEUE')

/** Placeholder until the BullMQ queue exists; keeps the API and its tests Redis-free. */
@Injectable()
export class NoopDeliveryQueue implements DeliveryQueue {
  enqueue(): Promise<void> {
    return Promise.resolve()
  }
}
