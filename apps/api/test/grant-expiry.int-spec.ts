import type {DeliveryQueue} from '../src/delivery/delivery-queue'
import {GrantExpiryService} from '../src/delivery/grant-expiry.service'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {startDatabase} from './support/database'

jest.setTimeout(180_000)

let db: Awaited<ReturnType<typeof startDatabase>>
let prisma: PrismaService
let enqueue: jest.Mock
let service: GrantExpiryService
let serverId: string
let productId: string

beforeAll(async () => {
  db = await startDatabase()
  prisma = new PrismaService()
  await seedCatalog(prisma)
  const product = await prisma.product.findFirstOrThrow({orderBy: {id: 'asc'}})
  productId = product.id
  serverId = product.serverId
})
afterAll(async () => {
  await prisma.$disconnect()
  await db.stop()
})
beforeEach(async () => {
  await prisma.delivery.deleteMany()
  await prisma.grant.deleteMany()
  await prisma.product.update({
    where: {id: productId},
    data: {revokeCommands: ['lp user {nick} parent remove vip']}
  })
  enqueue = jest.fn().mockResolvedValue(undefined)
  const queue: DeliveryQueue = {enqueue}
  service = new GrantExpiryService(prisma, queue)
})

const now = new Date('2026-10-30T12:00:00Z')
const grant = (data: {nick: string; expiresAt: Date | null}) =>
  prisma.grant.create({data: {serverId, productId, ...data}})

describe('GrantExpiryService', () => {
  it('revokeExpired creates one REVOKE delivery per expired grant', async () => {
    const g = await grant({nick: 'Steve', expiresAt: new Date(now.getTime() - 1000)})
    expect(await service.revokeExpired(now)).toBe(1)
    const updated = await prisma.grant.findUniqueOrThrow({where: {id: g.id}})
    expect(updated.revokedAt).toEqual(now)
    const deliveries = await prisma.delivery.findMany({where: {grantId: g.id}})
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      kind: 'REVOKE',
      orderItemId: null,
      serverId,
      status: 'PENDING',
      commands: ['lp user Steve parent remove vip']
    })
    expect(enqueue).toHaveBeenCalledWith(deliveries[0]?.id)
  })

  it('running it twice creates one', async () => {
    const g = await grant({nick: 'Steve', expiresAt: new Date(now.getTime() - 1000)})
    expect(await service.revokeExpired(now)).toBe(1)
    expect(await service.revokeExpired(now)).toBe(0)
    expect(await prisma.delivery.count({where: {grantId: g.id}})).toBe(1)
    expect(enqueue).toHaveBeenCalledTimes(1)
  })

  it('a grant with no expiresAt is not revoked', async () => {
    const g = await grant({nick: 'Alex', expiresAt: null})
    expect(await service.revokeExpired(now)).toBe(0)
    const row = await prisma.grant.findUniqueOrThrow({where: {id: g.id}})
    expect(row.revokedAt).toBeNull()
    expect(await prisma.delivery.count()).toBe(0)
  })

  it('a product without revoke commands still sets revokedAt and completes without a delivery', async () => {
    await prisma.product.update({where: {id: productId}, data: {revokeCommands: []}})
    const g = await grant({nick: 'Steve', expiresAt: new Date(now.getTime() - 1000)})
    expect(await service.revokeExpired(now)).toBe(1)
    const row = await prisma.grant.findUniqueOrThrow({where: {id: g.id}})
    expect(row.revokedAt).toEqual(now)
    expect(await prisma.delivery.count()).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })
})
