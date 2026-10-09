import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
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
})
