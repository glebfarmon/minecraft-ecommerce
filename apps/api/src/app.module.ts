import {Module} from '@nestjs/common'

import {AccessModule} from './access/access.module'
import {AuditModule} from './audit/audit.module'
import {AuthModule} from './auth/auth.module'
import {CatalogAdminModule} from './catalog-admin/catalog-admin.module'
import {CatalogModule} from './catalog/catalog.module'
import {ContentModule} from './content/content.module'
import {HealthModule} from './health/health.module'
import {MailerModule} from './mailer/mailer.module'
import {OrdersModule} from './orders/orders.module'
import {PaymentsModule} from './payments/payments.module'
import {PrismaModule} from './prisma/prisma.module'
import {RedisModule} from './redis/redis.module'
import {StatusModule} from './status/status.module'
import {TeamModule} from './team/team.module'
import {ThrottleModule} from './throttle/throttle.module'

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MailerModule,
    PaymentsModule,
    AuthModule,
    AccessModule,
    AuditModule,
    HealthModule,
    StatusModule,
    CatalogModule,
    CatalogAdminModule,
    ContentModule,
    OrdersModule,
    TeamModule,
    ThrottleModule
  ]
})
export class AppModule {}
