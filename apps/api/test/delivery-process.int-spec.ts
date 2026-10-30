import {randomBytes} from 'node:crypto'

import type {RconTarget} from '../src/catalog-admin/rcon/rcon-tester'
import {createDeliveriesForPaidOrder} from '../src/delivery/delivery-creation'
import type {DeliveryQueue} from '../src/delivery/delivery-queue'
import type {SendOutcome} from '../src/delivery/delivery-rules'
import {DeliveryService, RCON_TIMEOUT_MS} from '../src/delivery/delivery.service'
import type {RconSender} from '../src/delivery/rcon-sender'
import type {Product} from '../src/generated/prisma/client'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {seedDemoRcon} from '../src/seed/seed-rcon'
import {startDatabase} from './support/database'

jest.setTimeout(180_000)

const DAY_MS = 86_400_000

type Script = (commands: readonly string[]) => SendOutcome
const answerAll: Script = commands => ({kind: 'done', replies: commands.map(c => `ok: ${c}`)})

/** Records what it was asked to send; answers with the next scripted outcome, then with `answerAll`. */
class ScriptedSender implements RconSender {
  readonly calls: {target: RconTarget; commands: string[]; timeoutMs: number}[] = []
  readonly script: Script[] = []
  send(target: RconTarget, commands: readonly string[], timeoutMs: number) {
    this.calls.push({target, commands: [...commands], timeoutMs})
    return Promise.resolve((this.script.shift() ?? answerAll)(commands))
  }
}

let db: Awaited<ReturnType<typeof startDatabase>>
let prisma: PrismaService
let sender: ScriptedSender
let enqueue: jest.Mock
let service: DeliveryService
const savedEnv = {...process.env}

beforeAll(async () => {
  db = await startDatabase()
  prisma = new PrismaService()
  await seedCatalog(prisma)
  process.env.RCON_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  process.env.RCON_ALLOW_PRIVATE_HOSTS = 'true'
  await seedDemoRcon(prisma, {
    ...process.env,
    SEED_RCON_HOST: '127.0.0.1',
    SEED_RCON_PORT: '25575',
    SEED_RCON_PASSWORD: 'int-test'
  })
})
afterAll(async () => {
  process.env = savedEnv
  await prisma.$disconnect()
  await db.stop()
})
beforeEach(() => {
  sender = new ScriptedSender()
  enqueue = jest.fn().mockResolvedValue(undefined)
  const queue: DeliveryQueue = {enqueue}
  service = new DeliveryService(prisma, sender, queue)
})

let seq = 0
const product = (kind: Product['kind'], skip = 0) =>
  prisma.product.findFirstOrThrow({where: {kind}, orderBy: {id: 'asc'}, skip})

/** A PAID order with one item per line, and its deliveries created as the payment webhook does. */
async function paidOrder(lines: {product: Product; quantity?: number}[], nick = 'Steve') {
  seq += 1
  const servers = await prisma.server.findMany()
  const order = await prisma.order.create({
    data: {
      publicId: `p${String(Date.now()).padStart(20, '0')}${String(seq)}`,
      nick,
      email: 'steve@example.com',
      locale: 'en',
      currency: 'EUR',
      subtotalMinor: 499,
      totalMinor: 499,
      status: 'PAID',
      paidAt: new Date(),
      deliveryConsentAt: new Date(),
      items: {
        create: lines.map(l => ({
          productId: l.product.id,
          serverId: l.product.serverId,
          quantity: l.quantity ?? 1,
          unitAmountMinor: 499,
          productName: l.product.slug,
          serverName: servers.find(s => s.id === l.product.serverId)?.name ?? '?'
        }))
      }
    },
    include: {items: {orderBy: {id: 'asc'}}}
  })
  const ids = await prisma.$transaction(tx => createDeliveriesForPaidOrder(tx, order))
  return {order, ids}
}

const delivery = (id: string) => prisma.delivery.findUniqueOrThrow({where: {id}})
const orderStatus = async (id: string) =>
  (await prisma.order.findUniqueOrThrow({where: {id}})).status
const only = (ids: string[]) => {
  const [id] = ids
  if (!id || ids.length !== 1) throw new Error(`expected one delivery, got ${String(ids.length)}`)
  return id
}
const closeTo = (actual: Date | null, expected: number) => {
  expect(actual).not.toBeNull()
  expect(Math.abs((actual?.getTime() ?? 0) - expected)).toBeLessThan(5_000)
}

it('done delivers the order', async () => {
  const p = await product('PERMANENT')
  const {order, ids} = await paidOrder([{product: p}])
  const id = only(ids)
  await service.process(id)
  expect(sender.calls).toHaveLength(1)
  expect(sender.calls[0]).toMatchObject({
    target: {host: '127.0.0.1', port: 25575, password: 'int-test'},
    commands: [`say [demo] Steve bought ${p.slug}`],
    timeoutMs: RCON_TIMEOUT_MS
  })
  expect(await delivery(id)).toMatchObject({
    status: 'DONE',
    attempts: 1,
    commandsDone: 1,
    startedAt: null,
    lastError: null,
    responseLog: [`ok: say [demo] Steve bought ${p.slug}`]
  })
  expect(await orderStatus(order.id)).toBe('DELIVERED')
  expect(enqueue).not.toHaveBeenCalled()
})

it('empty command list is DONE', async () => {
  const {order, ids} = await paidOrder([{product: await product('PERMANENT')}])
  const id = only(ids)
  await prisma.delivery.update({where: {id}, data: {commands: []}})
  await service.process(id)
  expect(sender.calls).toHaveLength(0)
  expect(await delivery(id)).toMatchObject({status: 'DONE', commandsDone: 0, attempts: 1})
  expect(await orderStatus(order.id)).toBe('DELIVERED')
})

it('connect failure schedules a retry and keeps commandsDone', async () => {
  const {order, ids} = await paidOrder([{product: await product('PERMANENT'), quantity: 2}])
  const id = only(ids)
  sender.script.push(() => ({kind: 'retryable', replies: [], error: 'connect ECONNREFUSED'}))
  const before = Date.now()
  await service.process(id)
  const row = await delivery(id)
  expect(row).toMatchObject({
    status: 'PENDING',
    attempts: 1,
    commandsDone: 0,
    startedAt: null,
    lastError: 'connect ECONNREFUSED',
    responseLog: []
  })
  closeTo(row.nextAttemptAt, before + 10_000)
  expect(enqueue).toHaveBeenCalledTimes(1)
  const [enqueuedId, delayMs] = enqueue.mock.calls[0] as [string, number]
  expect(enqueuedId).toBe(id)
  expect(delayMs).toBeGreaterThan(5_000)
  expect(delayMs).toBeLessThanOrEqual(10_000)
  expect(await orderStatus(order.id)).toBe('PAID')
})

it('retry resumes after the last replied command', async () => {
  const p = await product('PERMANENT')
  const {order, ids} = await paidOrder([{product: p, quantity: 3}])
  const id = only(ids)
  await prisma.delivery.update({where: {id}, data: {commands: ['cmd 1', 'cmd 2', 'cmd 3']}})
  sender.script.push(() => ({kind: 'retryable', replies: ['r1'], error: 'Not connected'}))
  await service.process(id)
  expect(await delivery(id)).toMatchObject({
    status: 'PENDING',
    commandsDone: 1,
    responseLog: ['r1']
  })
  await service.process(id)
  expect(sender.calls.map(c => c.commands)).toEqual([
    ['cmd 1', 'cmd 2', 'cmd 3'],
    ['cmd 2', 'cmd 3']
  ])
  expect(await delivery(id)).toMatchObject({
    status: 'DONE',
    attempts: 2,
    commandsDone: 3,
    responseLog: ['r1', 'ok: cmd 2', 'ok: cmd 3']
  })
  expect(await orderStatus(order.id)).toBe('DELIVERED')
})

it('10th failed attempt is FAILED', async () => {
  const {order, ids} = await paidOrder([{product: await product('PERMANENT')}])
  const id = only(ids)
  await prisma.delivery.update({where: {id}, data: {attempts: 9}})
  sender.script.push(() => ({kind: 'retryable', replies: [], error: 'Authentication failed'}))
  await service.process(id)
  expect(await delivery(id)).toMatchObject({
    status: 'FAILED',
    attempts: 10,
    lastError: 'Authentication failed',
    startedAt: null
  })
  expect(enqueue).not.toHaveBeenCalled()
  expect(await orderStatus(order.id)).toBe('PAID')
})

it('unconfirmed is NEEDS_REVIEW and never re-sent by process', async () => {
  const {order, ids} = await paidOrder([{product: await product('PERMANENT')}])
  const id = only(ids)
  sender.script.push(() => ({kind: 'unconfirmed', replies: [], error: 'timeout'}))
  await service.process(id)
  await service.process(id)
  expect(sender.calls).toHaveLength(1)
  expect(await delivery(id)).toMatchObject({
    status: 'NEEDS_REVIEW',
    attempts: 1,
    lastError: 'timeout',
    startedAt: null
  })
  expect(enqueue).not.toHaveBeenCalled()
  expect(await orderStatus(order.id)).toBe('PAID')
})

it('two items on two servers: order is DELIVERED only after both', async () => {
  const first = await product('PERMANENT')
  const second = await prisma.product.findFirstOrThrow({
    where: {kind: 'PERMANENT', serverId: {not: first.serverId}}
  })
  const {order, ids} = await paidOrder([{product: first}, {product: second}])
  expect(ids).toHaveLength(2)
  const [a, b] = ids as [string, string]
  await service.process(a)
  expect(await orderStatus(order.id)).toBe('PAID')
  await service.process(b)
  expect(await orderStatus(order.id)).toBe('DELIVERED')
  const servers = await prisma.delivery.findMany({where: {id: {in: ids}}, select: {serverId: true}})
  expect(new Set(servers.map(s => s.serverId)).size).toBe(2)
})

describe('TIMED grants', () => {
  const grantOf = async (deliveryId: string) => {
    const {grantId} = await delivery(deliveryId)
    if (!grantId) throw new Error('delivery has no grant')
    return prisma.grant.findUniqueOrThrow({where: {id: grantId}})
  }

  it('TIMED GRANT done starts the clock', async () => {
    const p = await product('TIMED')
    const {ids} = await paidOrder([{product: p, quantity: 2}], 'Timed_1')
    const id = only(ids)
    expect((await grantOf(id)).expiresAt).toBeNull()
    const before = Date.now()
    await service.process(id)
    const grant = await grantOf(id)
    closeTo(grant.expiresAt, before + (p.durationDays ?? 0) * 2 * DAY_MS)
    expect(grant.revokedAt).toBeNull()
  })

  it('repurchase extends from the current expiry', async () => {
    const p = await product('TIMED')
    const first = await paidOrder([{product: p}], 'Timed_2')
    await service.process(only(first.ids))
    const current = new Date(Date.now() + 5 * DAY_MS)
    await prisma.grant.update({
      where: {id: (await grantOf(only(first.ids))).id},
      data: {expiresAt: current}
    })
    const second = await paidOrder([{product: p}], 'Timed_2')
    await service.process(only(second.ids))
    const grant = await grantOf(only(second.ids))
    expect(grant.expiresAt?.getTime()).toBe(current.getTime() + (p.durationDays ?? 0) * DAY_MS)
  })

  it('repurchase after revoke reopens the grant', async () => {
    const p = await product('TIMED')
    const first = await paidOrder([{product: p}], 'Timed_3')
    await service.process(only(first.ids))
    await prisma.grant.update({
      where: {id: (await grantOf(only(first.ids))).id},
      data: {expiresAt: new Date(Date.now() - DAY_MS), revokedAt: new Date()}
    })
    const second = await paidOrder([{product: p}], 'Timed_3')
    const before = Date.now()
    await service.process(only(second.ids))
    const grant = await grantOf(only(second.ids))
    expect(grant.revokedAt).toBeNull()
    closeTo(grant.expiresAt, before + (p.durationDays ?? 0) * DAY_MS)
  })

  it('complete on a DONE delivery changes nothing', async () => {
    const p = await product('TIMED')
    const {ids} = await paidOrder([{product: p}], 'Timed_4')
    const id = only(ids)
    await service.process(id)
    const once = await grantOf(id)
    await prisma.$transaction(tx => service.complete(tx, id))
    expect((await grantOf(id)).expiresAt).toEqual(once.expiresAt)
  })
})

it('process on a non-PENDING delivery does nothing', async () => {
  const {ids} = await paidOrder([{product: await product('PERMANENT')}])
  const id = only(ids)
  await prisma.delivery.update({where: {id}, data: {status: 'FAILED', attempts: 10}})
  const before = await delivery(id)
  await service.process(id)
  await service.process('no-such-delivery')
  expect(sender.calls).toHaveLength(0)
  expect(await delivery(id)).toEqual(before)
})

describe('server settings', () => {
  const withServer = async (
    data: {rconPasswordEnc?: null; isActive?: boolean},
    run: () => Promise<void>
  ) => {
    const p = await product('PERMANENT')
    const saved = await prisma.server.findUniqueOrThrow({where: {id: p.serverId}})
    await prisma.server.update({where: {id: p.serverId}, data})
    try {
      await run()
    } finally {
      await prisma.server.update({
        where: {id: p.serverId},
        data: {rconPasswordEnc: saved.rconPasswordEnc, isActive: saved.isActive}
      })
    }
  }

  it('unconfigured server retries with rcon_not_configured', async () => {
    await withServer({rconPasswordEnc: null}, async () => {
      const {ids} = await paidOrder([{product: await product('PERMANENT')}])
      const id = only(ids)
      await service.process(id)
      expect(sender.calls).toHaveLength(0)
      expect(await delivery(id)).toMatchObject({
        status: 'PENDING',
        attempts: 1,
        lastError: 'rcon_not_configured'
      })
      expect(enqueue).toHaveBeenCalledWith(id, expect.any(Number))
    })
  })

  it('disabled server retries with server_disabled', async () => {
    await withServer({isActive: false}, async () => {
      const {ids} = await paidOrder([{product: await product('PERMANENT')}])
      const id = only(ids)
      await service.process(id)
      expect(sender.calls).toHaveLength(0)
      expect(await delivery(id)).toMatchObject({status: 'PENDING', lastError: 'server_disabled'})
    })
  })
})
