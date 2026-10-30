import {Inject, Injectable, Logger} from '@nestjs/common'

import {PrismaService} from '../prisma/prisma.service'
import {DELIVERY_QUEUE, type DeliveryQueue} from './delivery-queue'

/** A RUNNING delivery older than this lost its worker. */
export const STALE_RUNNING_MS = 300_000

/**
 * Safety net for the queue (spec §4 steps 7-8): re-enqueues due PENDING deliveries and hands
 * stale RUNNING ones to a human. A stale row is never retried, since a command may have been sent.
 */
@Injectable()
export class DeliverySweeperService {
  private readonly log = new Logger(DeliverySweeperService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueue
  ) {}

  async sweep(now: Date = new Date()): Promise<{enqueued: number; escalated: number}> {
    const escalated = await this.prisma.delivery.updateMany({
      where: {status: 'RUNNING', startedAt: {lt: new Date(now.getTime() - STALE_RUNNING_MS)}},
      data: {status: 'NEEDS_REVIEW', lastError: 'worker_lost', startedAt: null}
    })
    const due = await this.prisma.delivery.findMany({
      where: {status: 'PENDING', nextAttemptAt: {lte: now}},
      select: {id: true},
      orderBy: {nextAttemptAt: 'asc'}
    })
    let enqueued = 0
    for (const {id} of due) {
      try {
        await this.queue.enqueue(id)
        enqueued += 1
      } catch (error) {
        this.log.error(`delivery ${id} not enqueued`, error)
      }
    }
    return {enqueued, escalated: escalated.count}
  }
}
