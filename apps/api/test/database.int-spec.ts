import {PrismaService} from '../src/prisma/prisma.service'
import {prisma, startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('database', () => {
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

  it('migrations match the schema (no drift)', () => {
    // --exit-code: 0 = no difference, 2 = difference (execFileSync throws on non-zero).
    expect(() =>
      prisma(
        [
          'migrate',
          'diff',
          '--from-config-datasource',
          '--to-schema',
          'prisma/schema.prisma',
          '--exit-code'
        ],
        db.url
      )
    ).not.toThrow()
  })

  const product = async (slug: string, kind: 'TIMED' | 'PERMANENT') => {
    const server = await client.server.upsert({
      where: {slug: 's'},
      update: {},
      create: {slug: 's', name: 'S', accent: '#000', onAccent: '#fff'}
    })
    const category = await client.category.upsert({
      where: {slug: 'c'},
      update: {},
      create: {slug: 'c'}
    })
    return client.product.create({
      data: {
        serverId: server.id,
        categoryId: category.id,
        slug,
        kind,
        mark: 'P',
        icon: 'crown',
        grantCommands: [],
        revokeCommands: []
      }
    })
  }

  it('rejects a TIMED product without a duration', async () => {
    await expect(product('timed', 'TIMED')).rejects.toThrow(/products_duration_matches_kind/)
  })

  it('rejects a zero price', async () => {
    const {id} = await product('permanent', 'PERMANENT')
    await expect(
      client.price.create({data: {productId: id, currency: 'EUR', amountMinor: 0}})
    ).rejects.toThrow(/prices_amount_positive/)
  })
})
