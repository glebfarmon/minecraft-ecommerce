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

  it('walks 120 rows in keyset pages, each id exactly once, and filters by actor', async () => {
    const admin = await signInAdmin(app, prisma, 'pat@example.com', 'ADMIN')
    const actor = await prisma.user.findUniqueOrThrow({where: {email: 'pat@example.com'}})
    const base = Date.now() + 3_600_000
    await prisma.auditLog.createMany({
      data: Array.from({length: 120}, (_, i) => ({
        actorId: actor.id,
        action: 'paging.test',
        ip: '10.0.0.9',
        // Pairs share a timestamp, so the id tiebreak is exercised.
        createdAt: new Date(base - Math.floor(i / 2) * 1000)
      }))
    })
    type Page = {entries: {id: string; actor: {id: string} | null}[]; nextCursor: string | null}
    const ids: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const res: {body: Page} = await admin
        .get('/api/admin/audit')
        .query({actorId: actor.id, action: 'paging.', ...(cursor ? {cursor} : {})})
        .expect(200)
      ids.push(...res.body.entries.map(e => e.id))
      expect(res.body.entries.every(e => e.actor?.id === actor.id)).toBe(true)
      cursor = res.body.nextCursor
      pages++
    } while (cursor)
    expect(pages).toBe(3)
    expect(ids).toHaveLength(120)
    expect(new Set(ids).size).toBe(120)
  })

  it('forbids the log to a role without audit.read', async () => {
    const support = await signInAdmin(app, prisma, 'sue@example.com', 'SUPPORT')
    await support.get('/api/admin/audit').expect(403)
  })
})
