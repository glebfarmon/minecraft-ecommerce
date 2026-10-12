import {PERMISSIONS} from '@shop/shared/access'

import {PermissionCache} from './permission-cache'

const role = (over = {}) => ({
  id: 'r1',
  name: 'ADMIN',
  isSystem: true,
  permissions: ['audit.read'],
  ...over
})

function setup(redisImpl: Partial<Record<'get' | 'set' | 'del', jest.Mock>> = {}) {
  const store = new Map<string, string>()
  const redis = {
    get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => {
      store.set(k, v)
      return Promise.resolve('OK')
    }),
    del: jest.fn((k: string) => {
      store.delete(k)
      return Promise.resolve(1)
    }),
    ...redisImpl
  }
  const findUniqueOrThrow = jest.fn(() => Promise.resolve(role()))
  const cache = new PermissionCache(redis as never, {role: {findUniqueOrThrow}} as never)
  return {cache, redis, findUniqueOrThrow}
}

describe('PermissionCache', () => {
  it('reads the database once, then Redis, for 60 s', async () => {
    const {cache, redis, findUniqueOrThrow} = setup()
    await cache.get('r1')
    await cache.get('r1')
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(1)
    expect(redis.set).toHaveBeenCalledWith('perm:role:r1', expect.any(String), 'EX', 60)
  })

  it('reloads after invalidation', async () => {
    const {cache, findUniqueOrThrow} = setup()
    await cache.get('r1')
    await cache.invalidate('r1')
    await cache.get('r1')
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(2)
  })

  it('gives OWNER every permission whatever the table says', async () => {
    const {cache, findUniqueOrThrow} = setup()
    findUniqueOrThrow.mockResolvedValueOnce(role({name: 'OWNER', permissions: []}))
    expect((await cache.get('r1')).permissions).toEqual([...PERMISSIONS])
  })

  it('gives OWNER every permission even from a stale cache entry', async () => {
    const {cache, redis} = setup()
    redis.get.mockResolvedValueOnce(
      JSON.stringify({name: 'OWNER', isSystem: true, permissions: ['audit.read']})
    )
    expect((await cache.get('r1')).permissions).toEqual([...PERMISSIONS])
  })

  it('drops permission strings the code no longer knows', async () => {
    const {cache, findUniqueOrThrow} = setup()
    findUniqueOrThrow.mockResolvedValueOnce(role({permissions: ['audit.read', 'gone.away']}))
    expect((await cache.get('r1')).permissions).toEqual(['audit.read'])
  })

  it('falls back to the database when Redis is down', async () => {
    const down = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')))
    const {cache} = setup({get: down, set: down})
    expect((await cache.get('r1')).permissions).toEqual(['audit.read'])
  })

  it('ignores a corrupt cache entry', async () => {
    const {cache, redis, findUniqueOrThrow} = setup()
    redis.get.mockResolvedValueOnce('not json')
    expect((await cache.get('r1')).permissions).toEqual(['audit.read'])
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(1)
  })

  it('does not fail invalidation when Redis is down', async () => {
    const down = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')))
    const {cache} = setup({del: down})
    await expect(cache.invalidate('r1')).resolves.toBeUndefined()
  })
})
