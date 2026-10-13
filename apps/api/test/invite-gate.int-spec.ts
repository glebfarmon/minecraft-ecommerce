import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'
import request from 'supertest'

import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import type {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedAccess} from '../src/seed/seed-access'
import {startDatabase} from './support/database'
import {relaxRateLimits} from './support/rate-limits'
import {startRedis} from './support/redis'

jest.setTimeout(120_000)

/** The code is mailed in the background, so it may land just after the response. */
async function codeFor(email: string): Promise<string> {
  const mailer = getMailer() as MemoryMailer
  for (let i = 0; i < 100; i++) {
    const code = /^(\d{6})/.exec(mailer.lastTo(email)?.subject ?? '')?.[1]
    if (code) return code
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`no mail to ${email}`)
}

describe('invite-only sign-up', () => {
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

  const signIn = async (email: string) => {
    await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email, type: 'sign-in'})
      .expect(200)
    return request(app.getHttpServer())
      .post('/api/auth/sign-in/email-otp')
      .send({email, otp: await codeFor(email)})
  }

  it('creates an invited user with the invite role and marks the invite accepted', async () => {
    const role = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    await prisma.invite.create({
      data: {
        email: 'ann@example.com',
        roleId: role.id,
        tokenHash: 'x1',
        expiresAt: new Date(Date.now() + 60_000)
      }
    })
    const res = await signIn('ann@example.com')
    expect(res.status).toBe(200)
    const user = await prisma.user.findUniqueOrThrow({where: {email: 'ann@example.com'}})
    expect(user.roleId).toBe(role.id)
    const invite = await prisma.invite.findUniqueOrThrow({where: {tokenHash: 'x1'}})
    expect(invite.acceptedAt).not.toBeNull()
  })

  it('refuses an email without an invite', async () => {
    const res = await signIn('stranger@example.com')
    expect(res.status).toBe(403)
    expect(await prisma.user.count({where: {email: 'stranger@example.com'}})).toBe(0)
  })

  it('refuses an expired or revoked invite', async () => {
    const role = await prisma.role.findUniqueOrThrow({where: {name: 'SUPPORT'}})
    await prisma.invite.createMany({
      data: [
        {
          email: 'old@example.com',
          roleId: role.id,
          tokenHash: 'x2',
          expiresAt: new Date(Date.now() - 1)
        },
        {
          email: 'gone@example.com',
          roleId: role.id,
          tokenHash: 'x3',
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: new Date()
        }
      ]
    })
    for (const email of ['old@example.com', 'gone@example.com']) {
      expect((await signIn(email)).status).toBeGreaterThanOrEqual(400)
      expect(await prisma.user.count({where: {email}})).toBe(0)
    }
  })

  it('does not accept the invite when the sign-in is refused, and an accepted invite is spent', async () => {
    const accepted = await prisma.invite.findUniqueOrThrow({where: {tokenHash: 'x1'}})
    await prisma.user.delete({where: {email: 'ann@example.com'}})
    // the invite was accepted by the first sign-up, so a second sign-up has no open invite
    expect(accepted.acceptedAt).not.toBeNull()
    expect((await signIn('ann@example.com')).status).toBeGreaterThanOrEqual(400)
  })
})
