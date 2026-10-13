import {createHash} from 'node:crypto'

import {betterAuth} from 'better-auth'
import {prismaAdapter} from 'better-auth/adapters/prisma'
import {APIError, createAuthMiddleware, getSessionFromCtx, isAPIError} from 'better-auth/api'
import {emailOTP, twoFactor} from 'better-auth/plugins'
import Redis from 'ioredis'

import {AuditService} from '../audit/audit.service'
import {CLIENT_IP_HEADER, requestIp} from '../common/client-ip'
import {getMailer} from '../mailer/create-mailer'
import {signInCodeMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'
import {rateLimits} from '../throttle/rate-limits'
import {authEnv} from './auth-env'
import {acceptInvite, inviteGate} from './invite-gate'
import {hit, otpAllowed, secondFactorAllowed} from './otp-limit'
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

/** Better Auth's own Redis client (same reason as `authPrisma`): rate-limit counters and OTP budgets. */
export const authRedis = (() => {
  let client: Redis | undefined
  return {
    get: (): Redis =>
      (client ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 1
      })),
    disconnect: (): void => {
      client?.disconnect()
    }
  }
})()

const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const cookieValue = (headers: Headers | undefined, name: string) =>
  new RegExp(`(?:^|;\\s*)(?:__Secure-)?${name}=([^;]+)`).exec(headers?.get('cookie') ?? '')?.[1]

const SECOND_FACTOR_CHECKS = new Set(['/two-factor/verify-totp', '/two-factor/verify-backup-code'])

export function createAuth(options: {baseURL?: string} = {}) {
  const env = authEnv(process.env)
  const baseURL = options.baseURL ?? env.baseURL
  const prisma = authPrisma.get()
  const redis = authRedis.get()
  const limits = rateLimits()
  const audit = new AuditService(prisma)
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
    // Better Auth's limiter keys on the address `stampClientIp` (auth.module.ts) wrote with the shared
    // rule (common/client-ip.ts); its own X-Forwarded-For parsing never sees the raw header.
    advanced: {ipAddress: {ipAddressHeaders: [CLIENT_IP_HEADER]}},
    user: {additionalFields: {roleId: {type: 'string', required: false, input: false}}},
    // Exposed so getSession() returns it to AdminSessionGuard; only the hook below writes it.
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      additionalFields: {twoFactorVerifiedAt: {type: 'date', required: false, input: false}}
    },
    // Counters live in Redis (`customStorage`), not in a table: `secondaryStorage` would also move
    // sessions out of Postgres. Fails closed when Redis is down.
    rateLimit: {
      enabled: true,
      window: 60,
      max: limits.default,
      customStorage: {
        consume: async (key, rule) => {
          try {
            const {count, ttlS} = await hit(redis, `ba:${key}`, rule.window)
            return count <= rule.max
              ? {allowed: true, retryAfter: null}
              : {allowed: false, retryAfter: Math.max(ttlS, 1)}
          } catch {
            return {allowed: false, retryAfter: rule.window}
          }
        }
      },
      customRules: {
        // Own limiter in sendVerificationOTP (per email / 10 min, per IP / hour), always answering 200.
        '/email-otp/send-verification-otp': false,
        // Library default is 3 per 10 s; a code is already capped at 5 attempts.
        '/sign-in/*': {window: 60, max: 30},
        // The two-factor plugin ships 3 per 10 s per IP (shared NAT, flaky in tests); the hook above
        // limits these two per user, which is stricter and not shared between people.
        '/two-factor/verify-totp': false,
        '/two-factor/verify-backup-code': false
      }
    },
    hooks: {
      before: createAuthMiddleware(async ctx => {
        if (SECOND_FACTOR_CHECKS.has(ctx.path)) {
          // Better Auth has no per-session limit on these; wrong codes would otherwise be free to guess.
          // Keyed by the session's user, never by IP alone: a brute force runs inside one session, and
          // a rotated X-Forwarded-For must not buy fresh guesses. Without a session (the sign-in
          // cookie flow) the two-factor cookie identifies the attempt, the proxy-set IP is the last resort.
          const current = await getSessionFromCtx(ctx)
          const pending = cookieValue(ctx.request?.headers, 'better-auth\\.two_factor')
          const subject = current
            ? `user:${current.user.id}`
            : pending
              ? `pending:${sha(pending)}`
              : `ip:${requestIp(ctx.request?.headers)}`
          if (!(await secondFactorAllowed(redis, subject, limits.secondFactor)))
            throw new APIError('TOO_MANY_REQUESTS', {message: 'Too many attempts, try again later'})
        }
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
        const failed = isAPIError(ctx.context.returned)
        const ip = ctx.request ? requestIp(ctx.request.headers) : ''
        // After-hooks also run for failed calls (a wrong code returns an APIError).
        if (ctx.path === '/sign-in/email-otp' || ctx.path.startsWith('/callback/')) {
          const userId = failed ? null : (ctx.context.newSession?.user.id ?? null)
          const body = ctx.body as {email?: unknown} | undefined
          await audit.record({
            actorId: userId,
            action: userId ? 'auth.sign_in' : 'auth.sign_in_failed',
            after: {email: typeof body?.email === 'string' ? body.email : null, method: ctx.path},
            ip
          })
        }
        // ...and never stamp those.
        if (failed) return
        // The first TOTP check replaces the session (BA sets newSession and deletes the old one);
        // later checks keep the current session (ctx.context.session).
        const current = ctx.context.newSession ?? ctx.context.session
        if (!current || !(await shouldStamp(ctx.path, current.user.id, isEnrolled))) return
        await prisma.session.update({
          where: {id: current.session.id},
          data: {twoFactorVerifiedAt: new Date()}
        })
        await audit.record({actorId: current.user.id, action: 'auth.2fa_verified', ip})
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
        sendVerificationOTP: async ({email, otp}, ctx) => {
          // Over the limit (or Redis down): answer as usual, send nothing (no enumeration).
          if (!(await otpAllowed(redis, email, requestIp(ctx?.request?.headers), limits))) return
          void signInCodeMail(otp)
            .then(mail => getMailer().send({to: email, ...mail}))
            .catch((error: unknown) => {
              console.error('mail: sign-in code failed', error)
            })
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
