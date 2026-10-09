import {Module} from '@nestjs/common'

import {CatalogModule} from './catalog/catalog.module'
import {HealthModule} from './health/health.module'
import {PrismaModule} from './prisma/prisma.module'
import {StatusModule} from './status/status.module'

@Module({imports: [PrismaModule, HealthModule, StatusModule, CatalogModule]})
export class AppModule {}
