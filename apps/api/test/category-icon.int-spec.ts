import {readFileSync} from 'node:fs'
import path from 'node:path'

import type {ProductIcon} from '@shop/shared/catalog'

import {PrismaService} from '../src/prisma/prisma.service'
import {API_ROOT, startDatabase} from './support/database'

jest.setTimeout(120_000)

const CATEGORY_ICON_SQL = readFileSync(
  path.join(API_ROOT, 'prisma/migrations/20261020120000_category_icon/migration.sql'),
  'utf8'
)

describe('category icon migration', () => {
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

  it('moves the most common product icon to its category, ties to the lowest sort, keeps products.icon', async () => {
    const server = await prisma.server.create({
      data: {slug: 'mig', name: 'M', accent: '#000000', onAccent: '#ffffff'}
    })
    const majority = await prisma.category.create({data: {slug: 'majority'}})
    const tie = await prisma.category.create({data: {slug: 'tie'}})
    await prisma.category.create({data: {slug: 'empty'}})
    const products: [string, ProductIcon, number][] = [
      [majority.id, 'crown', 0],
      [majority.id, 'box', 1],
      [majority.id, 'box', 2],
      [tie.id, 'coins', 1],
      [tie.id, 'swords', 0]
    ]
    const ids = await Promise.all(
      products.map(async ([categoryId, icon, sort], i) => {
        const p = await prisma.product.create({
          data: {
            serverId: server.id,
            categoryId,
            slug: `p${String(i)}`,
            kind: 'PERMANENT',
            mark: 'M',
            sort,
            grantCommands: [],
            revokeCommands: []
          }
        })
        return {id: p.id, icon}
      })
    )

    // Put the tables back the way they were before the migration: icons on the products, required, no default.
    await prisma.$executeRawUnsafe('ALTER TABLE "categories" DROP COLUMN "icon"')
    for (const {id, icon} of ids)
      await prisma.$executeRaw`UPDATE "products" SET "icon" = ${icon}::"ProductIcon" WHERE "id" = ${id}`
    await prisma.$executeRawUnsafe('ALTER TABLE "products" ALTER COLUMN "icon" DROP DEFAULT')
    await prisma.$executeRawUnsafe('ALTER TABLE "products" ALTER COLUMN "icon" SET NOT NULL')

    const statements = CATEGORY_ICON_SQL.split('\n')
      .filter(line => !line.startsWith('--'))
      .join('\n')
      .split(';')
      .filter(s => s.trim())
    for (const statement of statements) await prisma.$executeRawUnsafe(statement)

    const icons = Object.fromEntries(
      (await prisma.category.findMany({select: {slug: true, icon: true}})).map(c => [
        c.slug,
        c.icon
      ])
    )
    expect(icons).toEqual({majority: 'box', tie: 'swords', empty: 'crown'})
    // Expand/contract: the previous release still reads products.icon, so the column stays (dropped next release),
    // now optional with a default, and the values are untouched.
    const column = await prisma.$queryRaw<{is_nullable: string; column_default: string | null}[]>`
      SELECT is_nullable, column_default FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'icon'`
    expect(column).toEqual([{is_nullable: 'YES', column_default: '\'crown\'::"ProductIcon"'}])
    const kept = await prisma.$queryRaw<{id: string; icon: string}[]>`
      SELECT "id", "icon"::text AS icon FROM "products"`
    expect(Object.fromEntries(kept.map(r => [r.id, r.icon]))).toEqual(
      Object.fromEntries(ids.map(r => [r.id, r.icon]))
    )
    // New code creates products without an icon.
    await prisma.$executeRaw`
      INSERT INTO "products" ("id", "serverId", "categoryId", "slug", "kind", "mark", "grantCommands", "revokeCommands")
      VALUES ('new', ${server.id}, ${tie.id}, 'new', 'PERMANENT', 'M', '{}', '{}')`
  })
})
