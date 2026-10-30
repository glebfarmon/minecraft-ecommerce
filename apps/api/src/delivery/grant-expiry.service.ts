import {Inject, Injectable, Logger} from '@nestjs/common'

import {PrismaService} from '../prisma/prisma.service'
import {DELIVERY_QUEUE, type DeliveryQueue} from './delivery-queue'
import {renderCommands} from './delivery-rules'

/** Revokes timed grants whose clock ran out (spec §5): one REVOKE delivery per grant. */
@Injectable()
export class GrantExpiryService {
  private readonly log = new Logger(GrantExpiryService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueue
  ) {}

  /** Returns how many grants this call revoked. */
  async revokeExpired(now: Date = new Date()): Promise<number> {
    const expired = await this.prisma.grant.findMany({
      where: {revokedAt: null, expiresAt: {lte: now}},
      include: {product: {select: {revokeCommands: true}}}
    })
    let revoked = 0
    const created: string[] = []
    for (const grant of expired) {
      const id = await this.prisma.$transaction(async tx => {
        const claimed = await tx.grant.updateMany({
          where: {id: grant.id, revokedAt: null, expiresAt: {lte: now}},
          data: {revokedAt: now}
        })
        if (claimed.count !== 1) return null
        revoked += 1
        if (grant.product.revokeCommands.length === 0) return undefined
        const delivery = await tx.delivery.create({
          data: {
            grantId: grant.id,
            serverId: grant.serverId,
            kind: 'REVOKE',
            commands: renderCommands(grant.product.revokeCommands, grant.nick, 1)
          },
          select: {id: true}
        })
        return delivery.id
      })
      if (id) created.push(id)
    }
    for (const id of created) {
      try {
        await this.queue.enqueue(id)
      } catch (error) {
        this.log.error(`revoke delivery ${id} not enqueued`, error)
      }
    }
    return revoked
  }
}
