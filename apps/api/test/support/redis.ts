import {RedisContainer} from '@testcontainers/redis'

/** A throwaway Redis (CI has no Redis service); sets REDIS_URL for clients created afterwards. */
export async function startRedis(): Promise<{url: string; stop: () => Promise<void>}> {
  const container = await new RedisContainer('redis:8-alpine').start()
  const url = container.getConnectionUrl()
  process.env.REDIS_URL = url
  return {
    url,
    stop: async () => {
      await container.stop()
    }
  }
}
