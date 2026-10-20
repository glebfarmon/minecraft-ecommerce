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

  it('moves the most common product icon to its category, ties to the lowest sort', async () => {
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

    // Put the tables back the way they were before the migration, icons on the products.
    await prisma.$executeRawUnsafe('ALTER TABLE "categories" DROP COLUMN "icon"')
    await prisma.$executeRawUnsafe('ALTER TABLE "products" ADD COLUMN "icon" "ProductIcon"')
    for (const {id, icon} of ids)
      await prisma.$executeRaw`UPDATE "products" SET "icon" = ${icon}::"ProductIcon" WHERE "id" = ${id}`
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
    const left = await prisma.$queryRaw<{n: bigint}[]>`
      SELECT count(*) AS n FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'icon'`
    expect(Number(left[0]?.n)).toBe(0)
  })
})
