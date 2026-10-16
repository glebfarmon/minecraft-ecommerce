import type {Mailer} from '../src/mailer/mailer'
import {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedAccess} from '../src/seed/seed-access'
import {seedCatalog} from '../src/seed/seed-catalog'
import {seedContent} from '../src/seed/seed-content'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('seedCatalog', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let client: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    client = new PrismaService()
  })

  afterAll(async () => {
    await client.$disconnect()
    await db.stop()
  })

  const counts = async () => [
    await client.server.count(),
    await client.category.count(),
    await client.serverCategory.count(),
    await client.product.count(),
    await client.productTranslation.count(),
    await client.price.count()
  ]

  it('loads the demo catalog', async () => {
    await seedCatalog(client)
    expect(await counts()).toEqual([3, 5, 12, 20, 40, 40])
  })

  it('is idempotent and never overwrites existing rows', async () => {
    await client.server.update({where: {slug: 'survival'}, data: {name: 'Edited'}})
    await seedCatalog(client)
    expect(await counts()).toEqual([3, 5, 12, 20, 40, 40])
    expect((await client.server.findUniqueOrThrow({where: {slug: 'survival'}})).name).toBe('Edited')
  })

  it('maps demo flags to kinds', async () => {
    const vip = await client.product.findFirstOrThrow({where: {slug: 'vip'}})
    const mythic = await client.product.findFirstOrThrow({where: {slug: 'mythic-case'}})
    expect([vip.kind, vip.durationDays]).toEqual(['TIMED', 30])
    expect([mythic.kind, mythic.durationDays]).toEqual(['CASE', null])
  })

  it('seeds the system roles and an owner invite once', async () => {
    const mailer = new MemoryMailer()
    process.env.ADMIN_OWNER_EMAIL = 'owner@example.com'
    try {
      const first = await seedAccess(client, mailer, 'http://admin.test')
      const second = await seedAccess(client, mailer, 'http://admin.test')
      expect(first.ownerInviteUrl).toMatch(/^http:\/\/admin\.test\/invite\/[\w-]{43}$/)
      expect(second.ownerInviteUrl).toBeNull() // an open owner invite already exists
    } finally {
      delete process.env.ADMIN_OWNER_EMAIL
    }
    const owner = await client.role.findUniqueOrThrow({where: {name: 'OWNER'}})
    expect(owner.isSystem).toBe(true)
    expect(await client.invite.count({where: {email: 'owner@example.com'}})).toBe(1)
    expect(mailer.lastTo('owner@example.com')).toBeDefined()
  })

  it('still returns the owner invite url when the invite mail fails', async () => {
    await client.invite.deleteMany({where: {email: 'owner2@example.com'}})
    const failing: Mailer = {send: () => Promise.reject(new Error('smtp down'))}
    process.env.ADMIN_OWNER_EMAIL = 'owner2@example.com'
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const res = await seedAccess(client, failing, 'http://admin.test')
      expect(res.ownerInviteUrl).toMatch(/^http:\/\/admin\.test\/invite\/[\w-]{43}$/)
      expect(spy.mock.calls.flat().join(' ')).not.toContain(res.ownerInviteUrl?.split('/').pop())
    } finally {
      spy.mockRestore()
      delete process.env.ADMIN_OWNER_EMAIL
    }
    expect(await client.invite.count({where: {email: 'owner2@example.com'}})).toBe(1)
  })

  it('seeds site content once when two api containers start together', async () => {
    // Each container runs the content seed at start (Dockerfile CMD) on its own connection.
    const other = new PrismaService()
    try {
      for (let round = 0; round < 5; round += 1) {
        await client.rulesVersion.deleteMany()
        await client.rulesDraft.deleteMany()
        await client.siteSettings.deleteMany()
        await Promise.all([seedContent(client), seedContent(other), seedContent(other)])
        expect([
          await client.rulesVersion.count(),
          await client.rulesDraft.count(),
          await client.siteSettings.count()
        ]).toEqual([1, 1, 1])
      }
    } finally {
      await other.$disconnect()
    }
  })

  it('never overwrites edited content or adds an edition on a re-run', async () => {
    await client.siteSettings.update({where: {id: 1}, data: {serverIp: 'edited.example.com'}})
    await seedContent(client)
    expect((await client.siteSettings.findUniqueOrThrow({where: {id: 1}})).serverIp).toBe(
      'edited.example.com'
    )
    expect(await client.rulesVersion.count()).toBe(1)
  })
})
