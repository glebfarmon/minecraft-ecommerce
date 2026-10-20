import {Prisma} from '../generated/prisma/client'
import type {PrismaService} from '../prisma/prisma.service'
import {CategoriesService} from './categories.service'
import {ProductsService} from './products.service'
import {ServersService} from './servers.service'

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('test', {code, clientVersion: 'test'})

const status = (error: unknown) =>
  (error as {getStatus?: () => number}).getStatus?.() ?? (error as {status?: number}).status
const body = (error: unknown) => (error as {getResponse: () => unknown}).getResponse()

describe('delete races', () => {
  it('reports a category that gained a reference after the check as 409 in_use', async () => {
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          slug: 'ranks',
          version: 1,
          translations: [],
          servers: [],
          _count: {products: 0}
        }),
        deleteMany: jest.fn().mockRejectedValue(prismaError('P2003'))
      }
    }
    const error: unknown = await new CategoriesService(prisma as unknown as PrismaService)
      .remove('c1', 1, () => undefined)
      .catch((e: unknown) => e)
    expect(status(error)).toBe(409)
    expect(body(error)).toMatchObject({message: 'in_use'})
  })

  it('reports a server that gained a product after the check as 409 in_use', async () => {
    const prisma = {
      server: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          slug: 'survival',
          name: 'Survival',
          accent: '#ff6b1a',
          onAccent: '#000000',
          isActive: false,
          sort: 0,
          version: 1,
          rconHost: null,
          rconPort: null,
          rconPasswordEnc: null,
          categories: [],
          _count: {products: 0}
        }),
        deleteMany: jest.fn().mockRejectedValue(prismaError('P2003'))
      }
    }
    const error: unknown = await new ServersService(prisma as unknown as PrismaService)
      .remove('s1', 1, false, () => undefined)
      .catch((e: unknown) => e)
    expect(status(error)).toBe(409)
    expect(body(error)).toMatchObject({message: 'in_use'})
  })
})

describe('product writes', () => {
  const input = {
    serverId: 's1',
    categoryId: 'c1',
    slug: 'vip',
    kind: 'PERMANENT' as const,
    durationDays: null,
    mark: 'VIP',
    grantCommands: [],
    revokeCommands: [],
    prices: {EUR: null, PLN: null},
    translations: {en: null, pl: null}
  }
  const failing = (error: unknown) => {
    const $transaction = jest.fn().mockRejectedValue(error)
    return {$transaction, service: new ProductsService({$transaction} as unknown as PrismaService)}
  }

  it.each([
    ['create', (s: ProductsService) => s.create(input)],
    [
      'update',
      (s: ProductsService) =>
        s.update('p1', {...input, isActive: false, version: 1}, () => undefined)
    ]
  ])(
    '%s runs serializable, so a concurrent detach cannot slip past the placement check',
    async (_, run) => {
      const {$transaction, service} = failing(prismaError('P2034'))
      const error: unknown = await run(service).catch((e: unknown) => e)
      expect($transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      })
      expect(body(error)).toMatchObject({message: 'stale'})
    }
  )

  it('still reports a taken slug as slug_taken', async () => {
    const {service} = failing(prismaError('P2002'))
    const error: unknown = await service.create(input).catch((e: unknown) => e)
    expect(status(error)).toBe(409)
    expect(body(error)).toMatchObject({message: 'slug_taken'})
  })
})

describe('category writes', () => {
  const stored = (icon: string) => ({
    id: 'c1',
    slug: 'ranks',
    icon,
    version: 1,
    translations: [],
    servers: [],
    _count: {products: 0}
  })
  const names = {en: 'Ranks', pl: 'Rangi'}

  it('create stores the icon and returns it', async () => {
    const create = jest.fn().mockResolvedValue(stored('box'))
    const service = new CategoriesService({category: {create}} as unknown as PrismaService)
    const out = await service.create({slug: 'ranks', names, icon: 'box'})
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({data: expect.objectContaining({icon: 'box'}) as unknown})
    )
    expect(out.icon).toBe('box')
  })

  it('update stores the icon with the version check', async () => {
    const updateMany = jest.fn().mockResolvedValue({count: 1})
    const tx = {
      category: {updateMany, findUniqueOrThrow: jest.fn().mockResolvedValue(stored('coins'))},
      categoryTranslation: {upsert: jest.fn()}
    }
    const prisma = {
      category: {findUnique: jest.fn().mockResolvedValue(stored('crown'))},
      $transaction: jest.fn((run: (t: typeof tx) => unknown) => run(tx))
    }
    const out = await new CategoriesService(prisma as unknown as PrismaService).update(
      'c1',
      {slug: 'ranks', names, icon: 'coins', version: 1},
      () => undefined
    )
    expect(updateMany).toHaveBeenCalledWith({
      where: {id: 'c1', version: 1},
      data: {slug: 'ranks', icon: 'coins', version: {increment: 1}}
    })
    expect(out.icon).toBe('coins')
  })
})
