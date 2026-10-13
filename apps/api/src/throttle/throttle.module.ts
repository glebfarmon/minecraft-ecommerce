import {createHash} from 'node:crypto'

import {ThrottlerStorageRedisService} from '@nest-lab/throttler-storage-redis'
import {type ExecutionContext, Module} from '@nestjs/common'
import {APP_GUARD} from '@nestjs/core'
import {
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerModuleOptions,
  type ThrottlerStorage
} from '@nestjs/throttler'
import type Redis from 'ioredis'

import {REDIS} from '../redis/redis.module'
import {rateLimits} from './rate-limits'

type ThrottledRequest = {
  ip?: string
  originalUrl?: string
  url?: string
  headers: {cookie?: string}
}

const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/

const isAdminPath = (req: ThrottledRequest) =>
  (req.originalUrl ?? req.url ?? '').startsWith('/api/admin')

/**
 * Admin API budget is per session: the Better Auth session cookie (plain or `__Secure-` on https),
 * hashed so tokens never reach Redis. Requests without one fall back to the IP.
 */
export function adminTracker(req: ThrottledRequest): string {
  const token = SESSION_COOKIE.exec(req.headers.cookie ?? '')?.[1]
  return token
    ? `session:${createHash('sha256').update(token).digest('hex')}`
    : `ip:${req.ip ?? 'unknown'}`
}

/**
 * The default limit protects availability, so a Redis outage lets those requests through; the
 * admin limit and every sign-in-code limit fail closed.
 */
class FailOpenDefaultStorage implements ThrottlerStorage {
  constructor(private readonly inner: ThrottlerStorageRedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ) {
    try {
      return await this.inner.increment(key, ttl, limit, blockDuration, throttlerName)
    } catch (error) {
      if (throttlerName !== 'default') throw error
      return {totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0}
    }
  }
}

const adminRequest = (ctx: ExecutionContext) => ctx.switchToHttp().getRequest<ThrottledRequest>()

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [REDIS],
      useFactory: (redis: Redis): ThrottlerModuleOptions => {
        const limits = rateLimits()
        return {
          throttlers: [
            // Everything outside the admin API: 100/min per IP.
            {
              name: 'default',
              ttl: 60_000,
              limit: limits.default,
              skipIf: ctx => isAdminPath(adminRequest(ctx))
            },
            // Admin API: 300/min per session.
            {
              name: 'admin',
              ttl: 60_000,
              limit: limits.admin,
              skipIf: ctx => !isAdminPath(adminRequest(ctx)),
              getTracker: req => adminTracker(req as ThrottledRequest)
            }
          ],
          storage: new FailOpenDefaultStorage(new ThrottlerStorageRedisService(redis))
        }
      }
    })
  ],
  providers: [{provide: APP_GUARD, useClass: ThrottlerGuard}]
})
export class ThrottleModule {}
