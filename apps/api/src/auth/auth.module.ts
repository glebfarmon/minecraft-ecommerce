import {Module, type OnApplicationShutdown} from '@nestjs/common'
import {AuthModule as BetterAuthModule} from '@thallesp/nestjs-better-auth'

import {auth, authPrisma, authRedis} from './auth'
import {stampClientIp} from './stamp-client-ip'

@Module({imports: [BetterAuthModule.forRoot({auth, middleware: stampClientIp})]})
export class AuthModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await authPrisma.disconnect()
    authRedis.disconnect()
  }
}
