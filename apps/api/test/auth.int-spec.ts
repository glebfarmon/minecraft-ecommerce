import type {Server} from 'node:http'

import {Body, Controller, Get, type INestApplication, Module, Post} from '@nestjs/common'
import request from 'supertest'

import {AppModule} from '../src/app.module'
import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import type {Mail} from '../src/mailer/mailer'
import type {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {startDatabase} from './support/database'
import {relaxRateLimits} from './support/rate-limits'
import {startRedis} from './support/redis'

jest.setTimeout(120_000)

/** Test-only routes: not marked anonymous, so they show what the global guard and body parsing do. */
@Controller('probe')
class ProbeController {
  @Get()
  get(): {ok: true} {
    return {ok: true}
  }

  @Post()
  post(@Body() body: unknown): unknown {
    return body
  }
}

@Module({imports: [AppModule], controllers: [ProbeController]})
class ProbeAppModule {}

/** The code is mailed in the background (spec §7.6), so it may land just after the response. */
async function mailTo(email: string): Promise<Mail> {
  const mailer = getMailer() as MemoryMailer
  for (let i = 0; i < 100; i++) {
    const mail = mailer.lastTo(email)
    if (mail) return mail
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`no mail to ${email}`)
}

describe('auth in NestJS', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let redis: Awaited<ReturnType<typeof startRedis>>
  let app: INestApplication<Server>
  let prisma: PrismaService

  beforeAll(async () => {
    ;[db, redis] = await Promise.all([startDatabase(), startRedis()])
    prisma = new PrismaService()
    relaxRateLimits()
    app = await createApp(ProbeAppModule)
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
    await Promise.all([db.stop(), redis.stop()])
  })

  it('keeps public endpoints anonymous', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200)
    await request(app.getHttpServer()).get('/api/health/ready').expect(200)
    await request(app.getHttpServer()).get('/api/catalog?locale=en').expect(200)
    const docs = await request(app.getHttpServer()).get('/api/docs').expect(200)
    expect(docs.text).toContain('swagger-ui')
  })

  it('keeps query validation and the JSON 404', async () => {
    const bad = await request(app.getHttpServer()).get('/api/catalog?locale=xx').expect(400)
    expect(bad.type).toBe('application/json')
    const missing = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404)
    expect(missing.body).toMatchObject({statusCode: 404})
  })

  it('serves Better Auth under /api/auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/ok').expect(200)
    expect(res.body).toEqual({ok: true})
  })

  it('rejects routes not marked anonymous with a JSON 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/probe').expect(401)
    expect(res.type).toBe('application/json')
    expect(res.body).toMatchObject({statusCode: 401})
  })

  it('sends a 6-digit sign-in code through the mailer', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email: 'someone@example.com', type: 'sign-in'})
      .expect(200)
    const mail = await mailTo('someone@example.com')
    expect(mail.subject).toMatch(/^\d{6} is your Shop Admin sign-in code$/)
  })

  it('signs in with the code and sets the session cookie that opens guarded routes', async () => {
    const email = 'otp-user@example.com'
    const role = await prisma.role.upsert({
      where: {name: 'SUPPORT'},
      update: {},
      create: {name: 'SUPPORT', permissions: [], isSystem: true}
    })
    await prisma.invite.create({
      data: {
        email,
        roleId: role.id,
        tokenHash: 'auth-spec',
        expiresAt: new Date(Date.now() + 60_000)
      }
    })
    await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email, type: 'sign-in'})
      .expect(200)
    const otp = (await mailTo(email)).subject.slice(0, 6)

    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email-otp')
      .send({email, otp})
      .expect(200)
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
    const session = cookies.find(c => c.startsWith('better-auth.session_token='))
    expect(session).toMatch(/HttpOnly/i)
    expect(session).toMatch(/SameSite=Lax/i)

    const cookie = session?.split(';')[0] ?? ''
    await request(app.getHttpServer()).get('/api/probe').set('Cookie', cookie).expect(200)
    const echo = await request(app.getHttpServer())
      .post('/api/probe')
      .set('Cookie', cookie)
      .send({hello: 'world'})
      .expect(201)
    expect(echo.body).toEqual({hello: 'world'})
  })

  it('routes the Google callback under /api/auth/callback/google', async () => {
    // Google is not configured in tests: Better Auth answers the route itself (no Nest 404 JSON).
    const res = await request(app.getHttpServer()).get('/api/auth/callback/google')
    expect(res.status).not.toBe(404)
  })
})
