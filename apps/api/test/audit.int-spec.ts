import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'
import request from 'supertest'

import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedAccess} from '../src/seed/seed-access'
import {signInAdmin} from './support/admin'
import {startDatabase} from './support/database'
import {relaxRateLimits} from './support/rate-limits'
import {startRedis} from './support/redis'

jest.setTimeout(120_000)

describe('audit log', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let redis: Awaited<ReturnType<typeof startRedis>>
  let app: INestApplication<Server>
  let prisma: PrismaService

  beforeAll(async () => {
    ;[db, redis] = await Promise.all([startDatabase(), startRedis()])
    prisma = new PrismaService()
    await seedAccess(prisma, getMailer(), 'http://admin.test')
    relaxRateLimits()
    app = await createApp()
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
    await Promise.all([db.stop(), redis.stop()])
  })

  it('writes sign-in events and lets audit.read page through them', async () => {
    const admin = await signInAdmin(app, prisma, 'ann@example.com', 'ADMIN')
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/email-otp')
      .send({email: 'ann@example.com', otp: '000000'})
    const page = await admin.get('/api/admin/audit').expect(200)
    const actions = (page.body as {entries: {action: string}[]}).entries.map(e => e.action)
    expect(actions).toEqual(
      expect.arrayContaining(['auth.sign_in', 'auth.sign_in_failed', 'auth.2fa_verified'])
    )
    expect(JSON.stringify(page.body)).not.toMatch(/otpauth:|"otp":"\d/)
    const filtered = await admin.get('/api/admin/audit?action=auth.sign_in_failed').expect(200)
    const failed = (filtered.body as {entries: {action: string}[]}).entries
    expect(failed.length).toBeGreaterThan(0)
    expect(failed.every(e => e.action === 'auth.sign_in_failed')).toBe(true)
  })

  it('keeps credentials out of every stored row', async () => {
    const rows = await prisma.auditLog.findMany()
    expect(rows.length).toBeGreaterThan(0)
    const text = JSON.stringify(rows)
    expect(text).not.toMatch(/otpauth:|"otp":"\d|backupCodes":\[|"secret":"[^[]/)
  })

  it('forbids the log to a role without audit.read', async () => {
    const support = await signInAdmin(app, prisma, 'sue@example.com', 'SUPPORT')
    await support.get('/api/admin/audit').expect(403)
  })
})
