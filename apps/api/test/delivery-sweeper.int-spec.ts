import {Logger} from '@nestjs/common'

import type {DeliveryQueue} from '../src/delivery/delivery-queue'
import {DeliverySweeperService, STALE_RUNNING_MS} from '../src/delivery/delivery-sweeper.service'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {startDatabase} from './support/database'

jest.setTimeout(180_000)

let db: Awaited<ReturnType<typeof startDatabase>>
let prisma: PrismaService
let enqueue: jest.Mock
let sweeper: DeliverySweeperService
let serverId: string

beforeAll(async () => {
  db = await startDatabase()
  prisma = new PrismaService()
  await seedCatalog(prisma)
  serverId = (await prisma.server.findFirstOrThrow()).id
})
afterAll(async () => {
  await prisma.$disconnect()
  await db.stop()
})
beforeEach(async () => {
  await prisma.delivery.deleteMany()
  enqueue = jest.fn().mockResolvedValue(undefined)
  const queue: DeliveryQueue = {enqueue}
  sweeper = new DeliverySweeperService(prisma, queue)
})

const make = (data: {
  status?: 'PENDING' | 'RUNNING'
  nextAttemptAt?: Date
  startedAt?: Date | null
}) =>
  prisma.delivery.create({
    data: {serverId, kind: 'GRANT', commands: ['say hi'], ...data}
  })

describe('DeliverySweeperService', () => {
  const now = new Date('2026-10-30T12:00:00Z')

  it('sweep enqueues due PENDING deliveries and skips future ones', async () => {
    const due = await make({nextAttemptAt: new Date(now.getTime() - 1000)})
    await make({nextAttemptAt: new Date(now.getTime() + 60_000)})
    const result = await sweeper.sweep(now)
    expect(result).toEqual({enqueued: 1, escalated: 0})
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue).toHaveBeenCalledWith(due.id)
  })

  it('stale RUNNING becomes NEEDS_REVIEW', async () => {
    const stale = await make({
      status: 'RUNNING',
      startedAt: new Date(now.getTime() - STALE_RUNNING_MS - 1000)
    })
    const result = await sweeper.sweep(now)
    expect(result).toEqual({enqueued: 0, escalated: 1})
    const row = await prisma.delivery.findUniqueOrThrow({where: {id: stale.id}})
    expect(row).toMatchObject({status: 'NEEDS_REVIEW', lastError: 'worker_lost', startedAt: null})
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('fresh RUNNING is left alone', async () => {
    const fresh = await make({
      status: 'RUNNING',
      startedAt: new Date(now.getTime() - STALE_RUNNING_MS + 5000)
    })
    const result = await sweeper.sweep(now)
    expect(result).toEqual({enqueued: 0, escalated: 0})
    const row = await prisma.delivery.findUniqueOrThrow({where: {id: fresh.id}})
    expect(row.status).toBe('RUNNING')
  })

  it('sweep survives an enqueue failure', async () => {
    const past = new Date(now.getTime() - 1000)
    const first = await make({nextAttemptAt: past})
    const second = await make({nextAttemptAt: past})
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    enqueue.mockRejectedValueOnce(new Error('redis down'))
    const result = await sweeper.sweep(now)
    expect(enqueue).toHaveBeenCalledTimes(2)
    expect(enqueue).toHaveBeenCalledWith(first.id)
    expect(enqueue).toHaveBeenCalledWith(second.id)
    expect(result.enqueued).toBe(1)
    expect(logged).toHaveBeenCalledTimes(1)
    logged.mockRestore()
  })
})
