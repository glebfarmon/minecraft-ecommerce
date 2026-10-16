import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'
import Redis from 'ioredis'
import {generateSync} from 'otplib'
import request from 'supertest'

import {AuditService} from '../src/audit/audit.service'
import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import type {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedAccess} from '../src/seed/seed-access'
import {startDatabase} from './support/database'
import {relaxRateLimits} from './support/rate-limits'
import {startRedis} from './support/redis'
import {freshTotp} from './support/totp'

jest.setTimeout(120_000)

/** The code is mailed in the background, so it may land just after the response. */
async function codeFor(email: string, previous?: string): Promise<string> {
  const mailer = getMailer() as MemoryMailer
  for (let i = 0; i < 100; i++) {
    const code = /^(\d{6})/.exec(mailer.lastTo(email)?.subject ?? '')?.[1]
    if (code && code !== previous) return code
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`no mail to ${email}`)
}

type Agent = ReturnType<typeof request.agent>

describe('admin session', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let redis: Awaited<ReturnType<typeof startRedis>>
  let app: INestApplication<Server>
  let prisma: PrismaService
  let secret = ''
  let lastCode: string | undefined

  const signIn = async (agent: Agent, email: string) => {
    await agent
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email, type: 'sign-in'})
      .expect(200)
    lastCode = await codeFor(email, lastCode)
    await agent.post('/api/auth/sign-in/email-otp').send({email, otp: lastCode}).expect(200)
  }

  /** The session the agent's cookie points to now. */
  const currentSession = async (agent: Agent) => {
    const res = await agent.get('/api/auth/get-session').expect(200)
    const id = (res.body as {session: {id: string}}).session.id
    return prisma.session.findUniqueOrThrow({where: {id}})
  }

  const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')

  beforeAll(async () => {
    ;[db, redis] = await Promise.all([startDatabase(), startRedis()])
    prisma = new PrismaService()
    await seedAccess(prisma, getMailer(), 'http://admin.test')
    const role = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    await prisma.invite.create({
      data: {
        email: 'ann@example.com',
        roleId: role.id,
        tokenHash: 'a',
        expiresAt: new Date(Date.now() + 60_000)
      }
    })
    relaxRateLimits()
    app = await createApp()
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
    await Promise.all([db.stop(), redis.stop()])
  })

  it('401 without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/me').expect(401)
    expect(res.type).toBe('application/json')
  })

  it('requires TOTP before any admin route, then lets the session in', async () => {
    const agent = request.agent(app.getHttpServer())
    await signIn(agent, 'ann@example.com')

    const blocked = await agent.get('/api/admin/me').expect(403)
    expect(blocked.body).toEqual({statusCode: 403, message: '2fa_required'})

    const enabled = await agent.post('/api/auth/two-factor/enable').send({}).expect(200)
    const body = enabled.body as {totpURI: string; backupCodes: string[]}
    secret = new URL(body.totpURI).searchParams.get('secret') ?? ''
    // Enrollment hands out backup codes before any authenticator is proven: they must not open the admin.
    const [enrollmentBackupCode] = body.backupCodes
    const refused = await agent
      .post('/api/auth/two-factor/verify-backup-code')
      .send({code: enrollmentBackupCode})
      .expect(403)
    expect((refused.body as {message?: string}).message).toBe('2fa_required')
    expect((await currentSession(agent)).twoFactorVerifiedAt).toBeNull()
    // Enabling alone does not verify the session (nor turn 2FA on for the user).
    await agent.get('/api/admin/me').expect(403)
    const user = await prisma.user.findUniqueOrThrow({where: {email: 'ann@example.com'}})
    expect(user.twoFactorEnabled).toBe(false)

    // A wrong code must not stamp the session.
    await agent
      .post('/api/auth/two-factor/verify-totp')
      .send({code: wrongCode(generateSync({secret}))})
      .expect(401)
    await agent.get('/api/admin/me').expect(403)

    const before = await currentSession(agent)
    await agent
      .post('/api/auth/two-factor/verify-totp')
      .send({code: await freshTotp(secret)})
      .expect(200)

    // The first verification replaces the session; the stamp is on the one the cookie now holds.
    const after = await currentSession(agent)
    expect(after.id).not.toBe(before.id)
    expect(after.twoFactorVerifiedAt).not.toBeNull()
    expect(await prisma.session.count({where: {id: before.id}})).toBe(0)

    const me = await agent.get('/api/admin/me').expect(200)
    expect(me.body).toEqual({
      id: user.id,
      email: 'ann@example.com',
      name: expect.any(String) as string,
      role: {
        id: user.roleId,
        name: 'ADMIN',
        isSystem: true,
        permissions: ['admin.invite', 'audit.read', 'catalog.write', 'server.rcon', 'content.write']
      },
      permissions: ['admin.invite', 'audit.read', 'catalog.write', 'server.rcon', 'content.write']
    })
  })

  it('makes every new session pass TOTP again, and stamps that same session', async () => {
    const agent = request.agent(app.getHttpServer())
    await signIn(agent, 'ann@example.com')
    await agent.get('/api/admin/me').expect(403)

    const before = await currentSession(agent)
    await agent
      .post('/api/auth/two-factor/verify-totp')
      .send({code: await freshTotp(secret)})
      .expect(200)
    const after = await currentSession(agent)
    expect(after.id).toBe(before.id)
    expect(after.twoFactorVerifiedAt).not.toBeNull()
    await agent.get('/api/admin/me').expect(200)
  })

  it('keeps an unverified session of an enrolled admin away from the 2FA settings', async () => {
    const agent = request.agent(app.getHttpServer())
    await signIn(agent, 'ann@example.com')
    // Each of these would let a mailbox-only session mint its own second factor.
    const paths = ['generate-backup-codes', 'get-totp-uri', 'disable', 'enable']
    const results: {path: string; status: number; message?: string}[] = []
    for (const path of paths) {
      const res = await agent.post(`/api/auth/two-factor/${path}`).send({})
      results.push({path, status: res.status, message: (res.body as {message?: string}).message})
    }
    expect(results).toEqual(paths.map(path => ({path, status: 403, message: '2fa_required'})))
    const twoFactor = await prisma.twoFactor.findFirstOrThrow({
      where: {user: {email: 'ann@example.com'}}
    })
    expect(twoFactor.verified).toBe(true)
    await agent.get('/api/admin/me').expect(403)
  })

  it('stamps a new session after a backup code issued to a verified session', async () => {
    const verified = request.agent(app.getHttpServer())
    await signIn(verified, 'ann@example.com')
    await verified
      .post('/api/auth/two-factor/verify-totp')
      .send({code: await freshTotp(secret)})
      .expect(200)
    const codes = await verified
      .post('/api/auth/two-factor/generate-backup-codes')
      .send({})
      .expect(200)
    const [backupCode] = (codes.body as {backupCodes: string[]}).backupCodes

    const agent = request.agent(app.getHttpServer())
    await signIn(agent, 'ann@example.com')
    await agent.get('/api/admin/me').expect(403)
    await agent.post('/api/auth/two-factor/verify-backup-code').send({code: backupCode}).expect(200)
    expect((await currentSession(agent)).twoFactorVerifiedAt).not.toBeNull()
    await agent.get('/api/admin/me').expect(200)
  })

  it('shuts out a disabled admin with 401', async () => {
    const agent = request.agent(app.getHttpServer())
    await signIn(agent, 'ann@example.com')
    await agent
      .post('/api/auth/two-factor/verify-totp')
      .send({code: await freshTotp(secret)})
      .expect(200)
    await agent.get('/api/admin/me').expect(200)
    await prisma.user.update({where: {email: 'ann@example.com'}, data: {disabledAt: new Date()}})
    try {
      await agent.get('/api/admin/me').expect(401)
    } finally {
      await prisma.user.update({where: {email: 'ann@example.com'}, data: {disabledAt: null}})
    }
  })

  it('refuses a TOTP code that was already used (replay), then accepts a fresh one', async () => {
    const first = request.agent(app.getHttpServer())
    await signIn(first, 'ann@example.com')
    const code = await freshTotp(secret)
    await first.post('/api/auth/two-factor/verify-totp').send({code}).expect(200)

    // A fresh sign-in (new session) presents the same code inside Better Auth's ±1 step window.
    const second = request.agent(app.getHttpServer())
    await signIn(second, 'ann@example.com')
    const replay = await second.post('/api/auth/two-factor/verify-totp').send({code}).expect(403)
    expect((replay.body as {message?: string}).message).toBe('totp_reused')
    expect((await currentSession(second)).twoFactorVerifiedAt).toBeNull()
    await second.get('/api/admin/me').expect(403)

    await second
      .post('/api/auth/two-factor/verify-totp')
      .send({code: await freshTotp(secret)})
      .expect(200)
    await second.get('/api/admin/me').expect(200)
  })

  it('keeps a successful sign-in and TOTP check when the audit write fails', async () => {
    const record = jest
      .spyOn(AuditService.prototype, 'record')
      .mockRejectedValue(new Error('audit table down'))
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const agent = request.agent(app.getHttpServer())
      await signIn(agent, 'ann@example.com')
      await agent
        .post('/api/auth/two-factor/verify-totp')
        .send({code: await freshTotp(secret)})
        .expect(200)
      await agent.get('/api/admin/me').expect(200)
      expect(record).toHaveBeenCalledTimes(2)
    } finally {
      record.mockRestore()
      quiet.mockRestore()
    }
  })

  it('caches role permissions in Redis under perm:role:<id>', async () => {
    const role = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    const client = new Redis(redis.url)
    try {
      expect(await client.ttl(`perm:role:${role.id}`)).toBeGreaterThan(0)
    } finally {
      client.disconnect()
    }
  })
})
