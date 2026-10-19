import {readFileSync} from 'node:fs'
import path from 'node:path'

import {parseRich, toPlainText} from '@shop/shared/rules'

import {PrismaService} from '../src/prisma/prisma.service'
import {API_ROOT, startDatabase} from './support/database'

jest.setTimeout(120_000)

const ESCAPE_SQL = readFileSync(
  path.join(API_ROOT, 'prisma/migrations/20261020100000_escape_product_descriptions/migration.sql'),
  'utf8'
)

describe('escape product descriptions migration', () => {
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

  it('escapes stray markup so the description still reads literally', async () => {
    const original = '2*3 [a](b) + \\ done'
    const server = await prisma.server.create({
      data: {slug: 'esc', name: 'E', accent: '#000000', onAccent: '#ffffff'}
    })
    const category = await prisma.category.create({data: {slug: 'esc'}})
    const product = await prisma.product.create({
      data: {
        serverId: server.id,
        categoryId: category.id,
        slug: 'esc',
        kind: 'PERMANENT',
        mark: 'ESC',
        icon: 'crown',
        grantCommands: [],
        revokeCommands: [],
        translations: {
          create: [
            {locale: 'en', name: 'E', description: original, sections: []},
            {locale: 'pl', name: 'E', description: 'Zwykły opis.', sections: []}
          ]
        }
      }
    })

    await prisma.$executeRawUnsafe(ESCAPE_SQL)

    const rows = await prisma.productTranslation.findMany({where: {productId: product.id}})
    const en = rows.find(r => r.locale === 'en')?.description ?? ''
    expect(en).toBe('2\\*3 \\[a\\]\\(b\\) \\+ \\\\ done')
    expect(toPlainText(parseRich(en, {links: false}))).toBe(original)
    expect(rows.find(r => r.locale === 'pl')?.description).toBe('Zwykły opis.')
  })
})
