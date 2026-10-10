import {Injectable, type OnModuleDestroy} from '@nestjs/common'
import {PrismaPg} from '@prisma/adapter-pg'

import {PrismaClient} from '../generated/prisma/client'
import {poolConfig} from './database-url'

/** Connects on the first query, so the app and its tests boot without a database. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({adapter: new PrismaPg(poolConfig())})
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
