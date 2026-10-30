import {randomBytes} from 'node:crypto'

import type {INestApplicationContext} from '@nestjs/common'
import {NestFactory} from '@nestjs/core'

import {encryptRconPassword, rconKey} from '../src/catalog-admin/rcon/rcon-crypto'
import {BullmqDeliveryQueue} from '../src/delivery/bullmq-delivery-queue'
import {DELIVERY_QUEUE, type DeliveryQueue} from '../src/delivery/delivery-queue'
import {DeliveryWorker} from '../src/delivery/delivery.worker'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {WorkerModule} from '../src/worker.module'
import {startDatabase} from './support/database'
import {startFakeRcon} from './support/fake-rcon'
import {startRedis} from './support/redis'

jest.setTimeout(180_000)

const PASSWORD = 'int-test'
/** Long enough that only the schedule a test shortens fires while it runs. */
const QUIET = {sweep: 3_600_000, expire: 3_600_000, alert: 3_600_000}

let db: Awaited<ReturnType<typeof startDatabase>>
let redis: Awaited<ReturnType<typeof startRedis>>
let rcon: Awaited<ReturnType<typeof startFakeRcon>>
let prisma: PrismaService
let serverId: string
let ctx: INestApplicationContext
const savedEnv = {...process.env}

beforeAll(async () => {
  ;[db, redis, rcon] = await Promise.all([startDatabase(), startRedis(), startFakeRcon(PASSWORD)])
  process.env.RCON_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  process.env.RCON_ALLOW_PRIVATE_HOSTS = 'true'
  prisma = new PrismaService()
  await seedCatalog(prisma)
  const server = await prisma.server.findFirstOrThrow({orderBy: {id: 'asc'}})
  await prisma.server.update({
    where: {id: server.id},
    data: {
      isActive: true,
      rconHost: '127.0.0.1',
      rconPort: rcon.port,
      rconPasswordEnc: encryptRconPassword(PASSWORD, rconKey())
    }
  })
  serverId = server.id
})
afterAll(async () => {
  process.env = savedEnv
  await prisma.$disconnect()
  await Promise.all([db.stop(), redis.stop(), rcon.stop()])
})
beforeEach(async () => {
  await prisma.delivery.deleteMany()
  rcon.commands.length = 0
  ctx = await NestFactory.createApplicationContext(WorkerModule, {logger: false})
  await jobs().obliterate({force: true})
})
afterEach(async () => {
  await ctx.close()
})

const queue = () => ctx.get<DeliveryQueue>(DELIVERY_QUEUE)
const worker = () => ctx.get(DeliveryWorker)
const jobs = () => ctx.get(BullmqDeliveryQueue).jobs

const make = (command: string, data: {serverId?: string; nextAttemptAt?: Date} = {}) =>
  prisma.delivery.create({data: {serverId, kind: 'GRANT', commands: [command], ...data}})

const statusOf = async (id: string) =>
  (await prisma.delivery.findUniqueOrThrow({where: {id}})).status

async function waitFor(check: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

describe('BullMQ delivery queue and worker', () => {
  it('the API binding is the BullMQ queue', () => {
    expect(queue()).toBeInstanceOf(BullmqDeliveryQueue)
  })

  it('enqueue then worker processes the delivery', async () => {
    const delivery = await make('say one')
    await worker().start(QUIET)
    await queue().enqueue(delivery.id)
    await waitFor(async () => (await statusOf(delivery.id)) === 'DONE')
    expect(rcon.commands).toEqual(['say one'])
  })

  it('enqueuing the same id twice runs once', async () => {
    const delivery = await make('say twice')
    await queue().enqueue(delivery.id)
    await queue().enqueue(delivery.id)
    expect(await jobs().getWaitingCount()).toBe(1)
    await worker().start(QUIET)
    await waitFor(async () => (await statusOf(delivery.id)) === 'DONE')
    // Give a second job, if there were one, the time to run.
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(rcon.commands).toEqual(['say twice'])
  })

  it('delayed enqueue runs after the delay', async () => {
    const delivery = await make('say later')
    await worker().start(QUIET)
    const started = Date.now()
    await queue().enqueue(delivery.id, 1_500)
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(await statusOf(delivery.id)).toBe('PENDING')
    await waitFor(async () => (await statusOf(delivery.id)) === 'DONE')
    expect(Date.now() - started).toBeGreaterThanOrEqual(1_500)
    expect(rcon.commands).toEqual(['say later'])
  })

  it('scheduler fires the sweep', async () => {
    // Never enqueued: only the sweep can find it.
    const delivery = await make('say swept', {nextAttemptAt: new Date(Date.now() - 1_000)})
    await worker().start({...QUIET, sweep: 300})
    await waitFor(async () => (await statusOf(delivery.id)) === 'DONE')
    expect(rcon.commands).toEqual(['say swept'])
  })

  it('a retry is queued again with its delay once the attempt finishes', async () => {
    const offline = await prisma.server.findFirstOrThrow({
      where: {id: {not: serverId}},
      orderBy: {id: 'asc'}
    })
    // A closed port: the connect fails, so the delivery goes back to PENDING with a backoff.
    await prisma.server.update({
      where: {id: offline.id},
      data: {
        isActive: true,
        rconHost: '127.0.0.1',
        rconPort: 1,
        rconPasswordEnc: encryptRconPassword(PASSWORD, rconKey())
      }
    })
    const delivery = await make('say retry', {serverId: offline.id})
    await worker().start(QUIET)
    await queue().enqueue(delivery.id)
    await waitFor(async () => (await jobs().getJobState(delivery.id)) === 'delayed')
    const row = await prisma.delivery.findUniqueOrThrow({where: {id: delivery.id}})
    expect(row).toMatchObject({status: 'PENDING', attempts: 1})
  })
})
