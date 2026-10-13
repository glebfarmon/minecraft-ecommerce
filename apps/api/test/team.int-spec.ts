import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'
import {generateSync} from 'otplib'
import request from 'supertest'

import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import type {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedAccess} from '../src/seed/seed-access'
import {emailedCode, signInAdmin} from './support/admin'
import {startDatabase} from './support/database'
import {relaxRateLimits} from './support/rate-limits'
import {startRedis} from './support/redis'

jest.setTimeout(120_000)

const tokenIn = (email: string) =>
  /invite\/([\w-]{43})/.exec((getMailer() as MemoryMailer).lastTo(email)?.text ?? '')?.[1] ?? ''

describe('team API', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let redis: Awaited<ReturnType<typeof startRedis>>
  let app: INestApplication<Server>
  let prisma: PrismaService

  const roleId = async (name: string) => (await prisma.role.findUniqueOrThrow({where: {name}})).id
  const userId = async (email: string) => (await prisma.user.findUniqueOrThrow({where: {email}})).id

  /** A returning admin: emailed code, then TOTP with the secret they enrolled. */
  const signInAgain = async (email: string, secret: string) => {
    const previous = /^(\d{6})/.exec(
      (getMailer() as MemoryMailer).lastTo(email)?.subject ?? ''
    )?.[1]
    const agent = request.agent(app.getHttpServer())
    await agent
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email, type: 'sign-in'})
      .expect(200)
    const otp = await emailedCode(email, previous)
    await agent.post('/api/auth/sign-in/email-otp').send({email, otp}).expect(200)
    await agent
      .post('/api/auth/two-factor/verify-totp')
      .send({code: generateSync({secret})})
      .expect(200)
    return agent
  }

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

  it('parses a JSON body on an admin route and still answers 401 without a session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .send({email: 'x@example.com', roleId: 'r'})
      .expect(401)
    expect(res.type).toBe('application/json')
  })

  it('invites a person, mails the link and lists the invite', async () => {
    const owner = await signInAdmin(app, prisma, 'owner@example.com', 'OWNER')
    const res = await owner
      .post('/api/admin/invites')
      .send({email: 'New@Example.com', roleId: await roleId('ADMIN')})
      .expect(201)
    expect(res.body).toMatchObject({
      email: 'new@example.com',
      role: {name: 'ADMIN'},
      acceptedAt: null,
      revokedAt: null
    })
    const token = tokenIn('new@example.com')
    expect(token).toHaveLength(43)
    expect(JSON.stringify(res.body)).not.toContain(token)
    expect(JSON.stringify(res.body)).not.toContain('/invite/')

    const lookup = await request(app.getHttpServer()).get(`/api/invite-lookup/${token}`).expect(200)
    expect(lookup.body).toEqual({email: 'new@example.com', status: 'valid'})
    await request(app.getHttpServer()).get('/api/invite-lookup/nope').expect(404)

    const list = await owner.get('/api/admin/invites').expect(200)
    const invites = list.body as {id: string; email: string}[]
    expect(invites[0]?.email).toBe('new@example.com')
    expect(JSON.stringify(list.body)).not.toContain(token)
  })

  it('resends with a fresh token and revokes, keeping tokens out of responses and audit', async () => {
    const owner = await signInAdmin(app, prisma, 'o-resend@example.com', 'OWNER')
    const created = await owner
      .post('/api/admin/invites')
      .send({email: 'later@example.com', roleId: await roleId('SUPPORT')})
      .expect(201)
    const id = (created.body as {id: string}).id
    const first = tokenIn('later@example.com')

    const resent = await owner.post(`/api/admin/invites/${id}/resend`).expect(201)
    const second = tokenIn('later@example.com')
    expect(second).not.toBe(first)
    expect(JSON.stringify(resent.body)).not.toContain(second)
    await request(app.getHttpServer()).get(`/api/invite-lookup/${first}`).expect(404)

    const revoked = await owner.delete(`/api/admin/invites/${id}`).expect(200)
    expect((revoked.body as {revokedAt: string | null}).revokedAt).not.toBeNull()
    const lookup = await request(app.getHttpServer())
      .get(`/api/invite-lookup/${second}`)
      .expect(200)
    expect(lookup.body).toEqual({email: 'later@example.com', status: 'revoked'})

    const again = await owner.post(`/api/admin/invites/${id}/resend`).expect(409)
    expect((again.body as {message: string}).message).toBe('invite_closed')
    await owner.delete(`/api/admin/invites/${id}`).expect(409)
    await owner.post('/api/admin/invites/missing/resend').expect(404)
    await owner.delete('/api/admin/invites/missing').expect(404)

    const rows = JSON.stringify(await prisma.auditLog.findMany({where: {entityType: 'invite'}}))
    expect(rows).toContain('invite.create')
    expect(rows).toContain('invite.resend')
    expect(rows).toContain('invite.revoke')
    expect(rows).not.toContain(first)
    expect(rows).not.toContain(second)
    expect(rows).not.toContain('/invite/')
  })

  it('refuses to invite anyone as OWNER, or with an unknown role', async () => {
    const owner = await signInAdmin(app, prisma, 'o2@example.com', 'OWNER')
    const res = await owner
      .post('/api/admin/invites')
      .send({email: 'x@example.com', roleId: await roleId('OWNER')})
      .expect(400)
    expect((res.body as {message: string}).message).toBe('owner_protected')
    await owner
      .post('/api/admin/invites')
      .send({email: 'x@example.com', roleId: 'missing'})
      .expect(400)
    expect(await prisma.invite.count({where: {email: 'x@example.com'}})).toBe(0)
  })

  it('refuses to invite an email that already has an account', async () => {
    const owner = await signInAdmin(app, prisma, 'o-dup@example.com', 'OWNER')
    const res = await owner
      .post('/api/admin/invites')
      .send({email: 'o-dup@example.com', roleId: await roleId('ADMIN')})
      .expect(409)
    expect((res.body as {message: string}).message).toBe('user_exists')
  })

  it('lists admins for admin.invite and forbids the team API to SUPPORT', async () => {
    const owner = await signInAdmin(app, prisma, 'o-list@example.com', 'OWNER')
    const list = await owner.get('/api/admin/admins').expect(200)
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'o-list@example.com',
          role: {id: await roleId('OWNER'), name: 'OWNER'},
          twoFactorEnabled: true,
          disabledAt: null
        })
      ])
    )
    const sue = await signInAdmin(app, prisma, 'sue@example.com', 'SUPPORT')
    await sue.get('/api/admin/admins').expect(403)
    await sue.get('/api/admin/invites').expect(403)
    await sue.post('/api/admin/roles').send({name: 'X1', permissions: []}).expect(403)
    // Every admin may read the roles (the team page shows them).
    const roles = await sue.get('/api/admin/roles').expect(200)
    expect((roles.body as {name: string}[]).map(r => r.name)).toEqual(
      expect.arrayContaining(['OWNER', 'ADMIN', 'SUPPORT'])
    )
  })

  it('changing a role ends that person’s sessions', async () => {
    const owner = await signInAdmin(app, prisma, 'o3@example.com', 'OWNER')
    const ann = await signInAdmin(app, prisma, 'ann@example.com', 'ADMIN')
    await ann.get('/api/admin/me').expect(200)
    // ADMIN has no role.write.
    await ann
      .patch(`/api/admin/admins/${await userId('o3@example.com')}/role`)
      .send({roleId: await roleId('SUPPORT')})
      .expect(403)
    const res = await owner
      .patch(`/api/admin/admins/${await userId('ann@example.com')}/role`)
      .send({roleId: await roleId('SUPPORT')})
      .expect(200)
    expect(res.body).toMatchObject({email: 'ann@example.com', role: {name: 'SUPPORT'}})
    await ann.get('/api/admin/me').expect(401)
    const again = await signInAgain('ann@example.com', ann.secret)
    const me = await again.get('/api/admin/me').expect(200)
    expect((me.body as {role: {name: string}}).role.name).toBe('SUPPORT')
  })

  it('protects the owner and system roles', async () => {
    const owner = await signInAdmin(app, prisma, 'o4@example.com', 'OWNER')
    const ann = await signInAdmin(app, prisma, 'ann2@example.com', 'ADMIN')
    const ownerId = await userId('o4@example.com')
    const expectProtected = (res: request.Response) => {
      expect(res.status).toBe(400)
      expect((res.body as {message: string}).message).toBe('owner_protected')
    }
    expectProtected(await ann.delete(`/api/admin/admins/${ownerId}`))
    expectProtected(await ann.post(`/api/admin/admins/${ownerId}/reset-2fa`))
    // Another owner cannot touch this owner either.
    const other = await signInAdmin(app, prisma, 'o4b@example.com', 'OWNER')
    expectProtected(
      await other.patch(`/api/admin/admins/${ownerId}/role`).send({roleId: await roleId('ADMIN')})
    )
    expectProtected(await other.post(`/api/admin/admins/${ownerId}/reset-2fa`))
    // Nobody is promoted to OWNER.
    expectProtected(
      await owner
        .patch(`/api/admin/admins/${await userId('ann2@example.com')}/role`)
        .send({roleId: await roleId('OWNER')})
    )
    for (const name of ['OWNER', 'ADMIN', 'SUPPORT']) {
      const id = await roleId(name)
      expectProtected(await owner.patch(`/api/admin/roles/${id}`).send({name, permissions: []}))
      expectProtected(await owner.delete(`/api/admin/roles/${id}`))
    }
    const ownerRow = await prisma.user.findUniqueOrThrow({
      where: {id: ownerId},
      include: {role: true}
    })
    expect(ownerRow.role?.name).toBe('OWNER')
    expect(ownerRow.disabledAt).toBeNull()
    await owner.get('/api/admin/me').expect(200)
    await owner.patch('/api/admin/admins/missing/role').send({roleId: 'x'}).expect(404)
  })

  it('lets an owner reset their own 2FA', async () => {
    const owner = await signInAdmin(app, prisma, 'o-self@example.com', 'OWNER')
    const res = await owner
      .post(`/api/admin/admins/${await userId('o-self@example.com')}/reset-2fa`)
      .expect(201)
    expect((res.body as {twoFactorEnabled: boolean}).twoFactorEnabled).toBe(false)
    await owner.get('/api/admin/me').expect(401)
  })

  it('resets 2FA: clears the factor, ends sessions, mails, and the person enrolls again', async () => {
    const owner = await signInAdmin(app, prisma, 'o-reset@example.com', 'OWNER')
    const dan = await signInAdmin(app, prisma, 'dan@example.com', 'ADMIN')
    const danId = await userId('dan@example.com')
    const res = await owner.post(`/api/admin/admins/${danId}/reset-2fa`).expect(201)
    expect(res.body).toMatchObject({email: 'dan@example.com', twoFactorEnabled: false})
    expect(await prisma.twoFactor.count({where: {userId: danId}})).toBe(0)
    expect(await prisma.session.count({where: {userId: danId}})).toBe(0)
    expect((getMailer() as MemoryMailer).lastTo('dan@example.com')?.subject).toMatch(
      /two-factor authentication was reset/
    )
    await dan.get('/api/admin/me').expect(401)

    // The next sign-in starts TOTP setup again.
    const previous = /^(\d{6})/.exec(
      (getMailer() as MemoryMailer).sent
        .filter(m => m.to === 'dan@example.com')
        .map(m => m.subject)
        .findLast(s => /^\d{6}/.test(s)) ?? ''
    )?.[1]
    const agent = request.agent(app.getHttpServer())
    await agent
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email: 'dan@example.com', type: 'sign-in'})
      .expect(200)
    const otp = await emailedCode('dan@example.com', previous)
    await agent
      .post('/api/auth/sign-in/email-otp')
      .send({email: 'dan@example.com', otp})
      .expect(200)
    const enabled = await agent.post('/api/auth/two-factor/enable').send({}).expect(200)
    const secret =
      new URL((enabled.body as {totpURI: string}).totpURI).searchParams.get('secret') ?? ''
    expect(secret).not.toBe(dan.secret)
    await agent
      .post('/api/auth/two-factor/verify-totp')
      .send({code: generateSync({secret})})
      .expect(200)
    await agent.get('/api/admin/me').expect(200)
  })

  it('a permission change applies to the next request', async () => {
    const owner = await signInAdmin(app, prisma, 'o5@example.com', 'OWNER')
    const editor = await owner
      .post('/api/admin/roles')
      .send({name: 'Auditor', permissions: ['audit.read']})
      .expect(201)
    expect(editor.body).toMatchObject({
      name: 'Auditor',
      isSystem: false,
      permissions: ['audit.read']
    })
    await owner.post('/api/admin/roles').send({name: 'Auditor', permissions: []}).expect(409)
    const id = (editor.body as {id: string}).id
    const bob = await signInAdmin(app, prisma, 'bob@example.com', 'Auditor')
    await bob.get('/api/admin/audit').expect(200)
    const updated = await owner
      .patch(`/api/admin/roles/${id}`)
      .send({name: 'Auditor', permissions: []})
      .expect(200)
    expect((updated.body as {permissions: string[]}).permissions).toEqual([])
    // Sessions of the role's users end on change (spec): bob must sign in again.
    await bob.get('/api/admin/audit').expect(401)
    const again = await signInAgain('bob@example.com', bob.secret)
    await again.get('/api/admin/audit').expect(403)

    // In use by bob: refused; once unused it goes.
    const inUse = await owner.delete(`/api/admin/roles/${id}`).expect(409)
    expect((inUse.body as {message: string}).message).toBe('role_in_use')
    await owner
      .patch(`/api/admin/admins/${await userId('bob@example.com')}/role`)
      .send({roleId: await roleId('SUPPORT')})
      .expect(200)
    await owner.delete(`/api/admin/roles/${id}`).expect(204)
    expect(await prisma.role.count({where: {id}})).toBe(0)
    await owner.delete(`/api/admin/roles/${id}`).expect(404)
  })

  it('refuses to delete a role an open invite still uses', async () => {
    const owner = await signInAdmin(app, prisma, 'o-inv@example.com', 'OWNER')
    const role = await owner
      .post('/api/admin/roles')
      .send({name: 'Helper', permissions: []})
      .expect(201)
    const id = (role.body as {id: string}).id
    await owner.post('/api/admin/invites').send({email: 'h@example.com', roleId: id}).expect(201)
    await owner.delete(`/api/admin/roles/${id}`).expect(409)
  })

  it('removing an admin disables, keeps the row and signs them out', async () => {
    const owner = await signInAdmin(app, prisma, 'o6@example.com', 'OWNER')
    const cat = await signInAdmin(app, prisma, 'cat@example.com', 'SUPPORT')
    const id = await userId('cat@example.com')
    const res = await owner.delete(`/api/admin/admins/${id}`).expect(200)
    expect((res.body as {disabledAt: string | null}).disabledAt).not.toBeNull()
    await cat.get('/api/admin/me').expect(401)
    expect(await prisma.user.count({where: {id}})).toBe(1)
    expect(await prisma.session.count({where: {userId: id}})).toBe(0)
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {action: 'admin.remove', entityId: id}
    })
    expect(audit.before).toMatchObject({email: 'cat@example.com', disabledAt: null})
  })
})
