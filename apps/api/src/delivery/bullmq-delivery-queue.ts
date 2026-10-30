import {Injectable, Logger, type OnApplicationShutdown} from '@nestjs/common'
import {Queue} from 'bullmq'
import Redis from 'ioredis'

import type {DeliveryQueue} from './delivery-queue'

/** One queue for deliveries and the schedulers that feed it (ADR 0011). */
export const DELIVERY_QUEUE_NAME = 'delivery'
export const DELIVER_JOB = 'deliver'
/** A payment webhook must not hang on Redis; the sweeper picks up what was not enqueued. */
export const ENQUEUE_TIMEOUT_MS = 3_000

export type DeliverJobData = {id: string}

/**
 * BullMQ's own connection, separate from the shared lazy `REDIS` client. `maxRetriesPerRequest:
 * null` is what a Worker requires; the producer gets the same so one factory serves both.
 */
export function bullmqRedis(): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    // BullMQ has already quit when we disconnect; ioredis would otherwise keep a timer for a
    // stream that failed to connect alive for its 2 s default.
    disconnectTimeout: 200
  })
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('enqueue timed out'))
    }, ms)
  })
  return Promise.race([work, timeout]).finally(() => {
    clearTimeout(timer)
  })
}

/**
 * Producer for the `delivery` queue. Postgres stays the source of truth: `jobId = deliveryId`
 * collapses duplicates, and BullMQ never retries (`attempts` 1) because the retry policy lives in
 * the delivery row. The connection opens on the first enqueue, so the API boots without Redis.
 */
@Injectable()
export class BullmqDeliveryQueue implements DeliveryQueue, OnApplicationShutdown {
  private readonly log = new Logger(BullmqDeliveryQueue.name)
  private redis?: Redis
  private queue?: Queue

  get connected(): boolean {
    return this.queue !== undefined
  }

  /** The BullMQ queue itself, for the worker's schedulers and for tests. */
  get jobs(): Queue {
    if (!this.queue) {
      this.redis = this.createConnection()
      this.queue = new Queue(DELIVERY_QUEUE_NAME, {connection: this.redis})
      this.queue.on('error', error => {
        this.log.error(`delivery queue: ${error.message}`)
      })
    }
    return this.queue
  }

  /** BullMQ's connection; a seam so tests can see when one is opened. */
  protected createConnection(): Redis {
    return bullmqRedis()
  }

  async enqueue(deliveryId: string, delayMs = 0): Promise<void> {
    const data: DeliverJobData = {id: deliveryId}
    await withTimeout(
      this.jobs.add(DELIVER_JOB, data, {
        jobId: deliveryId,
        delay: delayMs,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true
      }),
      ENQUEUE_TIMEOUT_MS
    )
  }

  async onApplicationShutdown(): Promise<void> {
    const {queue, redis} = this
    this.queue = undefined
    this.redis = undefined
    if (!queue || !redis) return
    try {
      await withTimeout(queue.close(), ENQUEUE_TIMEOUT_MS)
    } catch (error) {
      this.log.warn(`delivery queue did not close cleanly: ${String(error)}`)
    }
    redis.disconnect()
  }
}
