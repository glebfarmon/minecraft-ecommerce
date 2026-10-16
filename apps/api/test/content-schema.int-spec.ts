import {readFileSync} from 'node:fs'
import path from 'node:path'

import {PrismaService} from '../src/prisma/prisma.service'
import {seedContent} from '../src/seed/seed-content'
import {API_ROOT, startDatabase} from './support/database'

jest.setTimeout(120_000)

const PERMISSION_SQL = readFileSync(
  path.join(API_ROOT, 'prisma/migrations/20261016100100_content_write_permission/migration.sql'),
  'utf8'
)

describe('site content schema', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let prisma: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    prisma = new PrismaService()
  })
  afterAll(async () => {
    await prisma.$disconnect()
    await db.stop()
  })

  it('seeds settings, a draft and the first published version once', async () => {
    await seedContent(prisma)
    await seedContent(prisma)
    expect(await prisma.rulesVersion.count()).toBe(1)
    const settings = await prisma.siteSettings.findUniqueOrThrow({where: {id: 1}})
    expect(settings).toMatchObject({siteNamePlain: 'Block', siteNameAccent: 'haus', version: 1})
    const draft = await prisma.rulesDraft.findUniqueOrThrow({where: {id: 1}})
    expect(draft.revision).toBe(0)
  })

  it('keeps an edited settings row on a re-run', async () => {
    await prisma.siteSettings.update({where: {id: 1}, data: {serverIp: 'play.example.com'}})
    await seedContent(prisma)
    expect((await prisma.siteSettings.findUniqueOrThrow({where: {id: 1}})).serverIp).toBe(
      'play.example.com'
    )
  })

  it('gives an existing ADMIN role content.write once', async () => {
    await prisma.role.create({data: {name: 'ADMIN', isSystem: true, permissions: ['admin.invite']}})
    await prisma.$executeRawUnsafe(PERMISSION_SQL)
    await prisma.$executeRawUnsafe(PERMISSION_SQL)
    const admin = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    expect(admin.permissions.filter(p => p === 'content.write')).toHaveLength(1)
  })
})
