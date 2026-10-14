import {Inject, Injectable} from '@nestjs/common'
import type Redis from 'ioredis'
import * as v from 'valibot'

import {PERMISSIONS, type Permission, PermissionSchema} from '@shop/shared/access'

import {PrismaService} from '../prisma/prisma.service'
import {REDIS} from '../redis/redis.module'

export type CachedRole = {name: string; isSystem: boolean; permissions: Permission[]}

const TTL_S = 60
const key = (roleId: string) => `perm:role:${roleId}`

/** What is stored: the role row as read, so OWNER's rule and unknown strings are applied on every read. */
const StoredRoleSchema = v.object({
  name: v.string(),
  isSystem: v.boolean(),
  permissions: v.array(v.string())
})
type StoredRole = v.InferOutput<typeof StoredRoleSchema>

function parseStored(raw: string | null): StoredRole | undefined {
  if (!raw) return undefined
  try {
    const parsed = v.safeParse(StoredRoleSchema, JSON.parse(raw))
    return parsed.success ? parsed.output : undefined
  } catch {
    return undefined
  }
}

export function resolveRole(role: StoredRole): CachedRole {
  return {
    name: role.name,
    isSystem: role.isSystem,
    // OWNER always holds every permission (spec decision #7); strings the code no longer knows are dropped.
    permissions:
      role.isSystem && role.name === 'OWNER'
        ? [...PERMISSIONS]
        : role.permissions.filter((p): p is Permission => v.is(PermissionSchema, p))
  }
}

/** Role permissions, cached in Redis for 60 s (spec decision #8). Redis failures fall back to the database. */
@Injectable()
export class PermissionCache {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService
  ) {}

  async get(roleId: string): Promise<CachedRole> {
    const cached = parseStored(await this.redis.get(key(roleId)).catch(() => null))
    if (cached) return resolveRole(cached)
    const row = await this.prisma.role.findUniqueOrThrow({where: {id: roleId}})
    const stored: StoredRole = {
      name: row.name,
      isSystem: row.isSystem,
      permissions: row.permissions
    }
    await this.redis.set(key(roleId), JSON.stringify(stored), 'EX', TTL_S).catch(() => undefined)
    return resolveRole(stored)
  }

  async invalidate(roleId: string): Promise<void> {
    await this.redis.del(key(roleId)).catch(() => undefined)
  }
}
