import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'
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

  it('limits public routes to 100 per minute per IP', async () => {
    let last = 0
    for (let i = 0; i < 101; i++)
      last = (await request(app.getHttpServer()).get('/api/health')).status
    expect(last).toBe(429)
  })
})
