import {randomBytes} from 'node:crypto'

import {Logger} from '@nestjs/common'

import {encryptRconPassword} from '../catalog-admin/rcon/rcon-crypto'
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
