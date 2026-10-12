import {betterAuth} from 'better-auth'
import {prismaAdapter} from 'better-auth/adapters/prisma'
import {emailOTP, twoFactor} from 'better-auth/plugins'

import {getMailer} from '../mailer/create-mailer'
import {signInCodeMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'

const DEFAULT_URL = 'http://admin.shop.localhost'

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
  const baseURL = options.baseURL ?? process.env.BETTER_AUTH_URL ?? DEFAULT_URL
  const prisma = authPrisma.get()
  return betterAuth({
    appName: 'Shop Admin',
    baseURL,
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET ?? 'dev-only-secret-change-me-at-least-32-chars',
    trustedOrigins: [baseURL],
    database: prismaAdapter(prisma, {provider: 'postgresql'}),
    session: {expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24},
    socialProviders: socialProviders(),
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
