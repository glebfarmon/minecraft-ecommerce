import {randomBytes} from 'node:crypto'

import {Logger} from '@nestjs/common'

import {encryptRconPassword} from '../catalog-admin/rcon/rcon-crypto'
import type {Prisma} from '../generated/prisma/client'
import type {PrismaService} from '../prisma/prisma.service'
import type {SendOutcome} from './delivery-rules'
import {DeliveryService, RCON_TIMEOUT_MS} from './delivery.service'

const key = randomBytes(32)
const savedEnv = {...process.env}
beforeAll(() => {
  process.env.RCON_ENCRYPTION_KEY = key.toString('base64')
})
afterAll(() => {
  process.env = savedEnv
})

type ServerOverrides = Partial<{
  isActive: boolean
  rconHost: string | null
  rconPort: number | null
  rconPasswordEnc: string | null
}>

function setup(opts: {
  claimed?: number
  server?: ServerOverrides
  send?: () => Promise<SendOutcome>
  enqueue?: () => Promise<void>
}) {
  const server = {
    id: 'srv1',
    isActive: true,
    rconHost: '203.0.113.7',
    rconPort: 25575,
    rconPasswordEnc: encryptRconPassword('pw', key),
    ...opts.server
  }
  const delivery = {
    id: 'd1',
    commands: ['say a', 'say b'],
    commandsDone: 0,
    attempts: 0,
    responseLog: [],
    server
  }
  const stored: Record<string, unknown>[] = []
  const tx = {
    delivery: {
      // Per call: `lockOrderOf` selects the order id, `complete` includes the item and order.
      findUnique: jest
        .fn()
        .mockImplementation(({select}: {select?: unknown}) =>
          Promise.resolve(
            select
              ? {orderItem: null}
              : {id: 'd1', kind: 'GRANT', status: 'RUNNING', grantId: null, orderItem: null}
          )
        ),
      updateMany: jest.fn().mockImplementation(({data}: {data: Record<string, unknown>}) => {
        stored.push(data)
        return Promise.resolve({count: 1})
      })
    }
  }
  const prisma = {
    delivery: {
      updateMany: jest.fn().mockResolvedValue({count: opts.claimed ?? 1}),
      findUniqueOrThrow: jest.fn().mockResolvedValue(delivery)
    },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx))
  }
  const sender = {
    send: jest.fn(
      opts.send ??
        (() => Promise.resolve<SendOutcome>({kind: 'retryable', replies: [], error: 'x'}))
    )
  }
  const queue = {enqueue: jest.fn(opts.enqueue ?? (() => Promise.resolve()))}
  const service = new DeliveryService(prisma as unknown as PrismaService, sender, queue)
  return {service, prisma, sender, queue, stored}
}

describe('DeliveryService.process', () => {
  it('does nothing when the claim fails', async () => {
    const {service, prisma, sender} = setup({claimed: 0})
    await service.process('d1')
    expect(prisma.delivery.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(sender.send).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('sends to the resolved address with the decrypted password', async () => {
    const {service, sender} = setup({})
    await service.process('d1')
    expect(sender.send).toHaveBeenCalledWith(
      {host: '203.0.113.7', port: 25575, password: 'pw'},
      ['say a', 'say b'],
      RCON_TIMEOUT_MS
    )
  })

  it.each<[string, ServerOverrides, string]>([
    ['disabled server', {isActive: false}, 'server_disabled'],
    ['no host', {rconHost: null}, 'rcon_not_configured'],
    ['no port', {rconPort: null}, 'rcon_not_configured'],
    ['no password', {rconPasswordEnc: null}, 'rcon_not_configured'],
    ['undecryptable password', {rconPasswordEnc: 'v1:bad:bad:bad'}, 'rcon_unavailable'],
    ['private host', {rconHost: '10.0.0.1'}, 'rcon_unavailable']
  ])('%s is retryable with %s and sends nothing', async (_name, server, error) => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const {service, sender, stored, queue} = setup({server})
    await service.process('d1')
    expect(sender.send).not.toHaveBeenCalled()
    expect(stored[0]).toMatchObject({status: 'PENDING', attempts: 1, lastError: error})
    expect(queue.enqueue).toHaveBeenCalledWith('d1', expect.any(Number))
    warn.mockRestore()
  })

  it('a throwing sender counts as unconfirmed', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const {service, stored, queue} = setup({send: () => Promise.reject(new Error('boom'))})
    await service.process('d1')
    expect(stored[0]).toMatchObject({status: 'NEEDS_REVIEW', lastError: 'boom'})
    expect(queue.enqueue).not.toHaveBeenCalled()
    logged.mockRestore()
  })

  it('a failing enqueue is only logged', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const {service, stored} = setup({enqueue: () => Promise.reject(new Error('redis down'))})
    await expect(service.process('d1')).resolves.toBeUndefined()
    expect(stored[0]).toMatchObject({status: 'PENDING'})
    expect(logged).toHaveBeenCalledWith('delivery d1 not re-enqueued', expect.any(Error))
    logged.mockRestore()
  })
})

describe('DeliveryService.complete', () => {
  type Row = {kind: string; status: string; grantId: string | null; orderStatus?: string}
  function completeSetup(row: Row) {
    const item = row.orderStatus
      ? {orderId: 'o1', quantity: 2, product: {durationDays: 30}, order: {status: row.orderStatus}}
      : null
    const tx = {
      delivery: {
        findUnique: jest
          .fn()
          .mockImplementation(({select}: {select?: unknown}) =>
            Promise.resolve(
              select
                ? {orderItem: item && {orderId: item.orderId}}
                : {id: 'd1', ...row, orderItem: item}
            )
          ),
        updateMany: jest.fn().mockResolvedValue({count: 1}),
        count: jest.fn().mockResolvedValue(0)
      },
      grant: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({id: 'g1', expiresAt: null, revokedAt: null}),
        update: jest.fn().mockResolvedValue({})
      },
      order: {updateMany: jest.fn().mockResolvedValue({count: 1})},
      $queryRaw: jest.fn().mockResolvedValue([])
    }
    const service = new DeliveryService(
      {} as PrismaService,
      {send: jest.fn()},
      {enqueue: jest.fn()}
    )
    const run = () => service.complete(tx as unknown as Prisma.TransactionClient, 'd1')
    return {tx, run}
  }

  it.each(['CANCELLED', 'DONE'])('leaves a %s delivery alone', async status => {
    const {tx, run} = completeSetup({kind: 'GRANT', status, grantId: 'g1', orderStatus: 'PAID'})
    await run()
    expect(tx.delivery.updateMany).not.toHaveBeenCalled()
    expect(tx.grant.update).not.toHaveBeenCalled()
    expect(tx.order.updateMany).not.toHaveBeenCalled()
  })

  it.each(['GRANT', 'RESTORE'])(
    'a timed %s on a PAID order extends the clock and settles',
    async kind => {
      const {tx, run} = completeSetup({kind, status: 'RUNNING', grantId: 'g1', orderStatus: 'PAID'})
      await run()
      expect(tx.$queryRaw).toHaveBeenCalledTimes(2) // the order row, then the grant
      expect(tx.grant.update).toHaveBeenCalledWith({
        where: {id: 'g1'},
        data: {expiresAt: expect.any(Date) as Date, revokedAt: null}
      })
      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: {id: 'o1', status: 'PAID'},
        data: {status: 'DELIVERED'}
      })
    }
  )

  it.each(['REFUNDED', 'DISPUTED'])(
    'on a %s order it is DONE but adds no time',
    async orderStatus => {
      const {tx, run} = completeSetup({
        kind: 'GRANT',
        status: 'NEEDS_REVIEW',
        grantId: 'g1',
        orderStatus
      })
      await run()
      expect(tx.delivery.updateMany).toHaveBeenCalledTimes(1)
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1) // only the order row
      expect(tx.grant.update).not.toHaveBeenCalled()
    }
  )

  it('a REVOKE never touches the grant clock', async () => {
    const {tx, run} = completeSetup({
      kind: 'REVOKE',
      status: 'FAILED',
      grantId: 'g1',
      orderStatus: 'REFUNDED'
    })
    await run()
    expect(tx.delivery.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.grant.update).not.toHaveBeenCalled()
  })
})
