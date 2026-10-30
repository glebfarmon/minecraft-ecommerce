import {Injectable, Logger, type OnModuleDestroy} from '@nestjs/common'
import {type Job, Worker} from 'bullmq'
import type Redis from 'ioredis'

import {PrismaService} from '../prisma/prisma.service'
import {
  BullmqDeliveryQueue,
  DELIVERY_QUEUE_NAME,
  DELIVER_JOB,
  type DeliverJobData,
  bullmqRedis
} from './bullmq-delivery-queue'
import {DeliveryAlertService} from './delivery-alert.service'
import {DeliverySweeperService} from './delivery-sweeper.service'
import {DeliveryService} from './delivery.service'
import {GrantExpiryService} from './grant-expiry.service'

export type ScheduleName = 'sweep' | 'expire' | 'alert'

/** How often each scheduler fires, in ms (spec §4 steps 7 and 9, §7). */
export const SCHEDULES: Readonly<Record<ScheduleName, number>> = {
  sweep: 60_000,
  expire: 3_600_000,
  alert: 300_000
}

/**
 * `SCHEDULES`, with the alert interval taken from `DELIVERY_ALERT_INTERVAL_MS` when it is set: an
 * e2e-only override, so the e2e need not wait five minutes for the owner alert. At least 1000 ms.
 */
export function schedulesFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Readonly<Record<ScheduleName, number>> {
  const raw = env.DELIVERY_ALERT_INTERVAL_MS
  if (!raw) return SCHEDULES
  const alert = Number(raw)
  if (!Number.isInteger(alert) || alert < 1000) {
    throw new Error(`DELIVERY_ALERT_INTERVAL_MS must be an integer of at least 1000, got "${raw}"`)
  }
  return {...SCHEDULES, alert}
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * The worker process's consumer of the `delivery` queue: `deliver` jobs and the three schedulers,
 * one job at a time (`concurrency: 1`), so RCON connections never overlap. A scheduler that throws
 * is logged and waits for its next run; it never stops the worker.
 */
@Injectable()
export class DeliveryWorker implements OnModuleDestroy {
  private readonly log = new Logger(DeliveryWorker.name)
  private worker?: Worker
  private redis?: Redis

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: BullmqDeliveryQueue,
    private readonly deliveries: DeliveryService,
    private readonly sweeper: DeliverySweeperService,
    private readonly expiry: GrantExpiryService,
    private readonly alerts: DeliveryAlertService
  ) {}

  /** Registers (or updates) the schedulers, then starts consuming. */
  async start(schedules: Readonly<Record<ScheduleName, number>> = SCHEDULES): Promise<void> {
    if (this.worker) return
    for (const [name, every] of Object.entries(schedules)) {
      await this.queue.jobs.upsertJobScheduler(
        name,
        {every},
        {name, opts: {attempts: 1, removeOnComplete: true, removeOnFail: true}}
      )
    }
    this.redis = bullmqRedis()
    this.worker = new Worker(DELIVERY_QUEUE_NAME, job => this.handle(job), {
      connection: this.redis,
      concurrency: 1
    })
    this.worker.on('error', error => {
      this.log.error(`delivery worker: ${error.message}`)
    })
    this.worker.on('completed', job => {
      if (job.name === DELIVER_JOB) void this.requeueRetry((job.data as DeliverJobData).id)
    })
    this.log.log(`delivery worker started; schedules ${JSON.stringify(schedules)}`)
  }

  async onModuleDestroy(): Promise<void> {
    const {worker, redis} = this
    this.worker = undefined
    this.redis = undefined
    // Waits for the running job, so a delivery is not left RUNNING by a deploy.
    await worker?.close()
    redis?.disconnect()
  }

  private async handle(job: Job): Promise<void> {
    try {
      switch (job.name) {
        case DELIVER_JOB:
          await this.deliveries.process((job.data as DeliverJobData).id)
          return
        case 'sweep': {
          const result = await this.sweeper.sweep()
          if (result.enqueued || result.escalated) this.log.log(`sweep: ${JSON.stringify(result)}`)
          return
        }
        case 'expire': {
          const revoked = await this.expiry.revokeExpired()
          if (revoked) this.log.log(`expire: ${String(revoked)} grants revoked`)
          return
        }
        case 'alert': {
          const sent = await this.alerts.sendPending()
          if (sent) this.log.log(`alert: ${String(sent)} deliveries announced`)
          return
        }
        default:
          this.log.warn(`unknown job ${job.name}`)
      }
    } catch (error) {
      // A failed delivery job leaves its row PENDING or RUNNING; the sweeper recovers both.
      this.log.error(`job ${job.name} (${String(job.id)}) failed: ${messageOf(error)}`)
    }
  }

  /**
   * A retry enqueued during its own attempt collapses into the job still running (same jobId), so
   * it is queued again once that job is removed. Without this the sweeper would find it later.
   */
  private async requeueRetry(deliveryId: string): Promise<void> {
    try {
      const row = await this.prisma.delivery.findUnique({
        where: {id: deliveryId},
        select: {status: true, nextAttemptAt: true}
      })
      const delayMs = row ? row.nextAttemptAt.getTime() - Date.now() : 0
      // Only a real backoff; anything already due is the sweeper's, so a broken row cannot spin.
      if (row?.status !== 'PENDING' || delayMs <= 0) return
      await this.queue.enqueue(deliveryId, delayMs)
    } catch (error) {
      this.log.error(`delivery ${deliveryId} not re-enqueued: ${messageOf(error)}`)
    }
  }
}
