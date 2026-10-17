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

import {clientIp} from '../common/client-ip'
import {REDIS} from '../redis/redis.module'
import {rateLimits} from './rate-limits'

type ThrottledRequest = {
  ip?: string
  socket?: {remoteAddress?: string}
  originalUrl?: string
  url?: string
  headers: Record<string, string | string[] | undefined> & {cookie?: string}
}

const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/

const ADMIN_PATH = /^\/api\/admin(?:[/?#]|$)/i

const ORDER_CREATE_PATH = /^\/api\/orders\/?(?:[?#]|$)/i

const RCON_TEST_PATH = /^\/api\/admin\/catalog\/servers\/[^/]+\/rcon\/test\/?(?:[?#]|$)/i

/** Express routes case-insensitively, so `/API/Admin/...` reaches admin handlers too. */
export const isAdminPath = (req: ThrottledRequest): boolean =>
  ADMIN_PATH.test(req.originalUrl ?? req.url ?? '')

/** Per-IP tracker with the API-wide client-address rule (common/client-ip.ts). */
export const ipTracker = (req: ThrottledRequest): string =>
  `ip:${clientIp(req.headers, req.socket?.remoteAddress ?? req.ip)}`

/**
 * One counter per throttler and tracker. The library default also hashes the controller and
 * handler names in, which would make every limit per route instead of per session / per IP.
 */
export const throttleKey = (name: string, tracker: string): string =>
  createHash('sha256').update(`${name}-${tracker}`).digest('hex')

/**
 * Admin API budget is per session: the Better Auth session cookie (plain or `__Secure-` on https),
 * hashed so tokens never reach Redis. Requests without one fall back to the IP.
 */
export function adminTracker(req: ThrottledRequest): string {
  const token = SESSION_COOKIE.exec(req.headers.cookie ?? '')?.[1]
  return token ? `session:${createHash('sha256').update(token).digest('hex')}` : ipTracker(req)
}

/**
 * The default limit protects availability, so a Redis outage lets those requests through; the
 * admin limit, the order limit and every sign-in-code limit fail closed.
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
            // Everything outside the admin API: per IP.
            {
              name: 'default',
              ttl: 60_000,
              limit: limits.default,
              skipIf: ctx => isAdminPath(adminRequest(ctx))
            },
            // Admin API: per session cookie (hashed).
            {
              name: 'admin',
              ttl: 60_000,
              limit: limits.admin,
              skipIf: ctx => !isAdminPath(adminRequest(ctx)),
              getTracker: req => adminTracker(req as ThrottledRequest)
            },
            // Admin API per IP as well: the throttler runs before AdminSessionGuard, so a client
            // inventing a new cookie per request would otherwise never be limited.
            {
              name: 'adminIp',
              ttl: 60_000,
              limit: limits.adminIp,
              skipIf: ctx => !isAdminPath(adminRequest(ctx))
            },
            // RCON connection tests: each opens a socket to a game server.
            {
              name: 'rconTest',
              ttl: 60_000,
              limit: limits.rconTest,
              skipIf: ctx =>
                !RCON_TEST_PATH.test(adminRequest(ctx).originalUrl ?? adminRequest(ctx).url ?? ''),
              getTracker: req => adminTracker(req as ThrottledRequest)
            },
            // Order creation: each one opens a payment session (parent spec §7.5).
            {
              name: 'order',
              ttl: 60_000,
              limit: limits.order,
              skipIf: ctx => {
                const req = adminRequest(ctx) as ThrottledRequest & {method?: string}
                return (
                  req.method !== 'POST' || !ORDER_CREATE_PATH.test(req.originalUrl ?? req.url ?? '')
                )
              }
            }
          ],
          getTracker: req => ipTracker(req as ThrottledRequest),
          generateKey: (_ctx, tracker, name) => throttleKey(name, tracker),
          storage: new FailOpenDefaultStorage(new ThrottlerStorageRedisService(redis))
        }
      }
    })
  ],
  providers: [{provide: APP_GUARD, useClass: ThrottlerGuard}]
})
export class ThrottleModule {}
