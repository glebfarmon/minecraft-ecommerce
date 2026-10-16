import {randomBytes} from 'node:crypto'
import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'
import Redis from 'ioredis'
import request from 'supertest'

import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import type {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedAccess} from '../src/seed/seed-access'
import {signInAdmin} from './support/admin'
import {startDatabase} from './support/database'
import {startRedis} from './support/redis'

jest.setTimeout(180_000)

describe('rate limits', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let redis: Awaited<ReturnType<typeof startRedis>>
  let app: INestApplication<Server>
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.RATE_LIMIT_ORDER = '2'
    ;[db, redis] = await Promise.all([startDatabase(), startRedis()])
    prisma = new PrismaService()
    await seedAccess(prisma, getMailer(), 'http://admin.test')
    app = await createApp()
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
    await Promise.all([db.stop(), redis.stop()])
  })

  it('stops the fourth code request for one email but answers 200 every time', async () => {
    const http = () =>
      request(app.getHttpServer())
        .post('/api/auth/email-otp/send-verification-otp')
        .send({email: 'flood@example.com', type: 'sign-in'})
    for (let i = 0; i < 4; i++) await http().expect(200) // no enumeration: same answer
    await new Promise(r => setTimeout(r, 200))
    expect(
      (getMailer() as MemoryMailer).sent.filter(m => m.to === 'flood@example.com')
    ).toHaveLength(3)
  })

  it('refuses the sixth rapid TOTP code and the sixth backup code', async () => {
    const admin = await signInAdmin(app, prisma, 'brute@example.com', 'OWNER')
    // signInAdmin spent one check; four more wrong codes fill the minute's five.
    for (let i = 0; i < 4; i++)
      await admin.post('/api/auth/two-factor/verify-totp').send({code: '000000'}).expect(401)
    await admin.post('/api/auth/two-factor/verify-totp').send({code: '000000'}).expect(429)
    await admin
      .post('/api/auth/two-factor/verify-backup-code')
      .send({code: 'aaaa-bbbb'})
      .expect(429)
  })

  it('still refuses the sixth wrong code when the client rotates a spoofed X-Forwarded-For', async () => {
    const admin = await signInAdmin(app, prisma, 'spoof@example.com', 'OWNER')
    const statuses: number[] = []
    for (let i = 0; i < 6; i++)
      statuses.push(
        (
          await admin
            .post('/api/auth/two-factor/verify-totp')
            .set('x-forwarded-for', `10.0.0.${String(i)}, 203.0.113.7`)
            .send({code: '000000'})
        ).status
      )
    // signInAdmin spent one check, so the 5th wrong code is already over the minute's budget.
    expect(statuses.slice(0, 4)).toEqual([401, 401, 401, 401])
    expect(statuses.slice(4)).toEqual([429, 429])
  })

  it('limits the admin API per session, not per IP', async () => {
    const busy = await signInAdmin(app, prisma, 'busy@example.com', 'OWNER')
    const other = await signInAdmin(app, prisma, 'other@example.com', 'OWNER')
    let last = 0
    for (let i = 0; i < 301; i++) last = (await busy.get('/api/admin/admins')).status
    expect(last).toBe(429)
    await other.get('/api/admin/admins').expect(200)
  })

  it('counts one admin budget per session across every admin route', async () => {
    const spread = await signInAdmin(app, prisma, 'spread@example.com', 'OWNER')
    const statuses: number[] = []
    for (let i = 0; i < 301; i++)
      statuses.push((await spread.get(i % 2 ? '/api/admin/me' : '/api/admin/admins')).status)
    expect(statuses.slice(0, 300).every(s => s === 200)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
  })

  it('bounds admin traffic per IP when every request carries a fresh made-up session cookie', async () => {
    let last = 0
    for (let i = 0; i < 601 && last !== 429; i++)
      last = (
        await request(app.getHttpServer())
          .get('/api/admin/me')
          .set('cookie', `better-auth.session_token=${randomBytes(16).toString('hex')}`)
      ).status
    expect(last).toBe(429)
  })

  it('keeps the per-IP code budget when the client rotates a spoofed first X-Forwarded-For hop', async () => {
    const mailer = getMailer() as MemoryMailer
    for (let i = 0; i < 11; i++)
      await request(app.getHttpServer())
        .post('/api/auth/email-otp/send-verification-otp')
        .set('x-forwarded-for', `10.9.${String(i)}.1, 203.0.113.99`)
        .send({email: `ip${String(i)}@example.com`, type: 'sign-in'})
        .expect(200)
    await new Promise(r => setTimeout(r, 200))
    expect(mailer.sent.filter(m => /^ip\d+@example\.com$/.test(m.to))).toHaveLength(10)
  })

  it('gives a counter left without TTL an expiry instead of locking the email forever', async () => {
    const client = new Redis(redis.url)
    try {
      await client.set('otp:email:stuck@example.com', '1')
      expect(await client.ttl('otp:email:stuck@example.com')).toBe(-1)
      await request(app.getHttpServer())
        .post('/api/auth/email-otp/send-verification-otp')
        .send({email: 'stuck@example.com', type: 'sign-in'})
        .expect(200)
      expect(await client.ttl('otp:email:stuck@example.com')).toBeGreaterThan(0)
    } finally {
      client.disconnect()
    }
  })

  it('limits order creation per IP without touching other routes', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 3; i++)
      statuses.push((await request(app.getHttpServer()).post('/api/orders').send({})).status)
    expect(statuses).toEqual([400, 400, 429])
    await request(app.getHttpServer()).get('/api/catalog?locale=en').expect(200)
  })

  it('limits public routes to 100 per minute per IP', async () => {
    let last = 0
    for (let i = 0; i < 101; i++)
      last = (await request(app.getHttpServer()).get('/api/health')).status
    expect(last).toBe(429)
  })
})
