import {Module} from '@nestjs/common'

import {AccessModule} from './access/access.module'
import {AuthModule} from './auth/auth.module'
import {CatalogModule} from './catalog/catalog.module'
import {HealthModule} from './health/health.module'
import {MailerModule} from './mailer/mailer.module'
import {PrismaModule} from './prisma/prisma.module'
import {RedisModule} from './redis/redis.module'
import {StatusModule} from './status/status.module'
import {TeamModule} from './team/team.module'

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MailerModule,
    AuthModule,
    AccessModule,
    HealthModule,
    StatusModule,
    CatalogModule,
    TeamModule
  ]
})
export class AppModule {}
