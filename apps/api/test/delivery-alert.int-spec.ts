import {Logger} from '@nestjs/common'

import {DeliveryAlertService} from '../src/delivery/delivery-alert.service'
import type {Mailer} from '../src/mailer/mailer'
import {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {startDatabase} from './support/database'

jest.setTimeout(180_000)

let db: Awaited<ReturnType<typeof startDatabase>>
let prisma: PrismaService
let mailer: MemoryMailer
let service: DeliveryAlertService
let serverId: string
let ownerRoleId: string

beforeAll(async () => {
  db = await startDatabase()
  prisma = new PrismaService()
  await seedCatalog(prisma)
  serverId = (await prisma.server.findFirstOrThrow()).id
  ownerRoleId = (
    await prisma.role.upsert({
      where: {name: 'OWNER'},
      update: {},
      create: {name: 'OWNER', permissions: []}
    })
  ).id
  process.env.BETTER_AUTH_URL = 'http://admin.test'
})
afterAll(async () => {
  await prisma.$disconnect()
  await db.stop()
})
beforeEach(async () => {
  await prisma.delivery.deleteMany()
  await prisma.grant.deleteMany()
  await prisma.user.deleteMany()
  mailer = new MemoryMailer()
  service = new DeliveryAlertService(prisma, mailer)
})

const owner = (n: number, data: {disabledAt?: Date; roleId?: string | null} = {}) =>
  prisma.user.create({
    data: {
      id: `u${String(n)}`,
      name: `Owner ${String(n)}`,
      email: `owner${String(n)}@example.com`,
      roleId: ownerRoleId,
      ...data
    }
  })
describe('DeliveryAlertService', () => {
  let productId: string
  beforeAll(async () => {
    productId = (await prisma.product.findFirstOrThrow()).id
  })
  const make = async (status: 'FAILED' | 'NEEDS_REVIEW' | 'PENDING' | 'DONE', nick = 'Steve') => {
    const grant = await prisma.grant.create({data: {nick, serverId, productId}})
    return prisma.delivery.create({
      data: {
        serverId,
        kind: 'GRANT',
        commands: ['say hi'],
        status,
        lastError: 'boom',
        grantId: grant.id
      }
    })
  }

  it('one email lists all unalerted stuck deliveries', async () => {
    await owner(1)
    await make('FAILED', 'Steve')
    await make('NEEDS_REVIEW', 'Alex')
    await make('PENDING', 'Nope')
    await make('DONE', 'Nope2')
    expect(await service.sendPending()).toBe(2)
    expect(mailer.sent).toHaveLength(1)
    const mail = mailer.lastTo('owner1@example.com')
    if (!mail) throw new Error('no mail')
    expect(mail.to).toBe('owner1@example.com')
    expect(mail.subject).toBe('Delivery needs attention (2)')
    expect(mail.text).toContain('Steve')
    expect(mail.text).toContain('Alex')
    expect(mail.text).not.toContain('Nope')
    expect(mail.text).toContain('http://admin.test/orders')
  })

  it('a delivery is announced once', async () => {
    await owner(1)
    await make('FAILED')
    expect(await service.sendPending()).toBe(1)
    expect(await service.sendPending()).toBe(0)
    expect(mailer.sent).toHaveLength(1)
  })

  it('no stuck deliveries sends nothing', async () => {
    await owner(1)
    await make('PENDING')
    expect(await service.sendPending()).toBe(0)
    expect(mailer.sent).toHaveLength(0)
  })

  it('every OWNER user gets the mail', async () => {
    await owner(1)
    await owner(2)
    await owner(3, {disabledAt: new Date()})
    await prisma.user.create({
      data: {id: 'u9', name: 'Other', email: 'other@example.com', roleId: null}
    })
    await make('FAILED')
    await service.sendPending()
    expect(mailer.sent.map(m => m.to).sort()).toEqual(['owner1@example.com', 'owner2@example.com'])
  })

  it('mail failure is swallowed', async () => {
    await owner(1)
    await owner(2)
    const send = jest.fn().mockRejectedValue(new Error('smtp down'))
    const failing: Mailer = {send}
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const delivery = await make('FAILED')
    await expect(new DeliveryAlertService(prisma, failing).sendPending()).resolves.toBe(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
    const row = await prisma.delivery.findUniqueOrThrow({where: {id: delivery.id}})
    expect(row.alertedAt).not.toBeNull()
  })
})
