import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'

import {createApp} from '../../src/create-app'
import {getMailer} from '../../src/mailer/create-mailer'
import {PrismaService} from '../../src/prisma/prisma.service'
import {seedAccess} from '../../src/seed/seed-access'
import {seedCatalog} from '../../src/seed/seed-catalog'
import {signInAdmin} from './admin'
import {startDatabase} from './database'
import {relaxRateLimits} from './rate-limits'
import {startRedis} from './redis'

/** Postgres + Redis + the seeded demo catalog and system roles, behind the real app. */
export async function startCatalogApp() {
  const [db, redis] = await Promise.all([startDatabase(), startRedis()])
  const prisma = new PrismaService()
  await seedAccess(prisma, getMailer(), 'http://admin.test')
  await seedCatalog(prisma)
  relaxRateLimits()
  const app: INestApplication<Server> = await createApp()
  await app.init()
  let n = 0
  /** A signed-in admin with a fresh email; `permissions` creates a custom role first. */
  const admin = async (role: 'OWNER' | 'ADMIN' | 'SUPPORT' | {permissions: string[]}) => {
    n += 1
    const roleName = typeof role === 'string' ? role : `Custom${String(n)}`
    if (typeof role !== 'string')
      await prisma.role.create({data: {name: roleName, permissions: role.permissions}})
    return signInAdmin(app, prisma, `catalog${String(n)}@example.com`, roleName)
  }
  return {
    app,
    prisma,
    admin,
    stop: async () => {
      await app.close()
      await prisma.$disconnect()
      await Promise.all([db.stop(), redis.stop()])
    }
  }
}
