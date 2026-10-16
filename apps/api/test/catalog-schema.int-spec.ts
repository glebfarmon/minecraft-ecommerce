import {readFileSync} from 'node:fs'
import path from 'node:path'

import {PrismaService} from '../src/prisma/prisma.service'
import {API_ROOT, startDatabase} from './support/database'

jest.setTimeout(120_000)

const PERMISSIONS_SQL = readFileSync(
  path.join(API_ROOT, 'prisma/migrations/20261014100100_catalog_admin_permissions/migration.sql'),
  'utf8'
)

describe('catalog admin schema', () => {
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

  it('starts every catalog row at version 1', async () => {
    const server = await prisma.server.create({
      data: {slug: 'v1', name: 'V', accent: '#000000', onAccent: '#ffffff'}
    })
    const category = await prisma.category.create({data: {slug: 'v1'}})
    expect(server.version).toBe(1)
    expect(category.version).toBe(1)
  })

  it('refuses a category slug the storefront cannot use', async () => {
    await expect(prisma.category.create({data: {slug: 'Bad Slug'}})).rejects.toThrow()
  })

  it('gives an existing ADMIN role the catalog permissions once, and leaves other roles alone', async () => {
    await prisma.role.create({
      data: {name: 'ADMIN', isSystem: true, permissions: ['admin.invite', 'audit.read']}
    })
    await prisma.role.create({data: {name: 'Editor', isSystem: false, permissions: []}})
    await prisma.$executeRawUnsafe(PERMISSIONS_SQL)
    await prisma.$executeRawUnsafe(PERMISSIONS_SQL)
    const admin = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    expect([...admin.permissions].sort()).toEqual(
      ['admin.invite', 'audit.read', 'catalog.write', 'server.rcon'].sort()
    )
    const editor = await prisma.role.findUniqueOrThrow({where: {name: 'Editor'}})
    expect(editor.permissions).toEqual([])
  })
})
