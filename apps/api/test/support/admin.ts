import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'
import {generateSync} from 'otplib'
import request from 'supertest'

import {getMailer} from '../../src/mailer/create-mailer'
import type {MemoryMailer} from '../../src/mailer/memory-mailer'
import type {PrismaService} from '../../src/prisma/prisma.service'

/** The code is mailed in the background, so it may land just after the response. */
export async function emailedCode(email: string, previous?: string): Promise<string> {
  const mailer = getMailer() as MemoryMailer
  for (let i = 0; i < 100; i++) {
    const code = /^(\d{6})/.exec(mailer.lastTo(email)?.subject ?? '')?.[1]
    if (code && code !== previous) return code
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`no mail to ${email}`)
}

/** Invite → emailed code → TOTP: returns an agent whose session passed 2FA, plus the TOTP secret. */
export async function signInAdmin(
  app: INestApplication<Server>,
  prisma: PrismaService,
  email: string,
  roleName: string
) {
  const role = await prisma.role.findUniqueOrThrow({where: {name: roleName}})
  await prisma.invite.create({
    data: {
      email,
      roleId: role.id,
      tokenHash: `t-${email}`,
      expiresAt: new Date(Date.now() + 60_000)
    }
  })
  const agent = request.agent(app.getHttpServer())
  await agent
    .post('/api/auth/email-otp/send-verification-otp')
    .send({email, type: 'sign-in'})
    .expect(200)
  const otp = await emailedCode(email)
  await agent.post('/api/auth/sign-in/email-otp').send({email, otp}).expect(200)
  const enabled = await agent.post('/api/auth/two-factor/enable').send({}).expect(200)
  const secret =
    new URL((enabled.body as {totpURI: string}).totpURI).searchParams.get('secret') ?? ''
  await agent
    .post('/api/auth/two-factor/verify-totp')
    .send({code: generateSync({secret})})
    .expect(200)
  return Object.assign(agent, {secret})
}
