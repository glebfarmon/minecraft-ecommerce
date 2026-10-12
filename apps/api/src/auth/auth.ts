import {betterAuth} from 'better-auth'
import {prismaAdapter} from 'better-auth/adapters/prisma'
import {APIError, createAuthMiddleware, getSessionFromCtx, isAPIError} from 'better-auth/api'
import {emailOTP, twoFactor} from 'better-auth/plugins'

import {getMailer} from '../mailer/create-mailer'
import {signInCodeMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'
import {authEnv} from './auth-env'
import {acceptInvite, inviteGate} from './invite-gate'
import {type GateSession, secondFactorGate, shouldStamp} from './second-factor'

function socialProviders() {
  const providers: NonNullable<Parameters<typeof betterAuth>[0]['socialProviders']> = {}
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)
    providers.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET
    }
  return providers
}

/** Better Auth's own Prisma client: the instance lives outside Nest DI, so it cannot use PrismaService's provider. */
export const authPrisma = (() => {
  let client: PrismaService | undefined
  return {
    get: (): PrismaService => (client ??= new PrismaService()),
    disconnect: async (): Promise<void> => {
      await client?.$disconnect()
    }
  }
})()

export function createAuth(options: {baseURL?: string} = {}) {
  const env = authEnv(process.env)
  const baseURL = options.baseURL ?? env.baseURL
  const prisma = authPrisma.get()
  const isEnrolled = async (userId: string) =>
    (await prisma.twoFactor.count({where: {userId, verified: true}})) > 0
  return betterAuth({
    appName: 'Shop Admin',
    baseURL,
    basePath: '/api/auth',
    secret: env.secret,
    trustedOrigins: [baseURL],
    database: prismaAdapter(prisma, {provider: 'postgresql'}),
    socialProviders: socialProviders(),
    user: {additionalFields: {roleId: {type: 'string', required: false, input: false}}},
    // Exposed so getSession() returns it to AdminSessionGuard; only the hook below writes it.
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      additionalFields: {twoFactorVerifiedAt: {type: 'date', required: false, input: false}}
    },
    hooks: {
      before: createAuthMiddleware(async ctx => {
        const decision = await secondFactorGate(
          ctx.path,
          () =>
            getSessionFromCtx<
              {twoFactorEnabled?: boolean | null},
              NonNullable<GateSession>['session']
            >(ctx),
          isEnrolled
        )
        if (decision === 'unauthorized') throw new APIError('UNAUTHORIZED')
        if (decision === '2fa_required') throw new APIError('FORBIDDEN', {message: '2fa_required'})
      }),
      after: createAuthMiddleware(async ctx => {
        // After-hooks also run for failed calls (a wrong code returns an APIError): never stamp those.
        if (isAPIError(ctx.context.returned)) return
        // The first TOTP check replaces the session (BA sets newSession and deletes the old one);
        // later checks keep the current session (ctx.context.session).
        const current = ctx.context.newSession ?? ctx.context.session
        if (!current || !(await shouldStamp(ctx.path, current.user.id, isEnrolled))) return
        await prisma.session.update({
          where: {id: current.session.id},
          data: {twoFactorVerifiedAt: new Date()}
        })
      })
    },
    databaseHooks: {
      user: {
        create: {
          // Invite-only: returning false would make the email-code route fail with a 500, so throw.
          before: async user => {
            const allowed = await inviteGate(prisma)(user)
            if (!allowed)
              throw new APIError('FORBIDDEN', {message: 'Sign-up is by invitation only'})
            return allowed
          },
          after: async user => {
            await acceptInvite(prisma)(user)
          }
        }
      }
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        // Do not await: the response time must not reveal whether the email exists (spec §7.6).
        sendVerificationOTP: ({email, otp}) => {
          void signInCodeMail(otp)
            .then(mail => getMailer().send({to: email, ...mail}))
            .catch((error: unknown) => {
              console.error('mail: sign-in code failed', error)
            })
          return Promise.resolve()
        }
      }),
      twoFactor({issuer: 'Shop Admin', allowPasswordless: true})
    ]
  })
}

export type Auth = ReturnType<typeof createAuth>

let instance: Auth | undefined
/** Built on first use, not at import: tests set DATABASE_URL (Testcontainers) after importing the app. */
export function getAuth(): Auth {
  instance ??= createAuth()
  return instance
}

/** The process-wide instance; a lazy view of `getAuth()` so importing this file reads no env. */
export const auth: Auth = new Proxy({} as Auth, {
  get: (_target, key) => Reflect.get(getAuth(), key) as unknown,
  has: (_target, key) => Reflect.has(getAuth(), key)
})
