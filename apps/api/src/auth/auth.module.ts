import {Module, type OnApplicationShutdown} from '@nestjs/common'
import {AuthModule as BetterAuthModule} from '@thallesp/nestjs-better-auth'

import {auth, authPrisma, authRedis} from './auth'
import {stampClientIp} from './stamp-client-ip'

/**
 * JSON body limit for every route outside /api/auth (Better Auth parses its own raw body there).
 * Express's 100 KB default refuses a normal bilingual rulebook; the rules schema allows more.
 */
export const JSON_BODY_LIMIT = '2mb'

@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth,
      middleware: stampClientIp,
      // rawBody: Stripe webhook signatures are computed over the exact bytes received.
      bodyParser: {json: {limit: JSON_BODY_LIMIT}, rawBody: true}
    })
  ]
})
export class AuthModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await authPrisma.disconnect()
    authRedis.disconnect()
  }
}
