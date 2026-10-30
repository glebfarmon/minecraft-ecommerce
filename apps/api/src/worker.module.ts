import {Module} from '@nestjs/common'

import {DeliveryModule} from './delivery/delivery.module'
import {DeliveryWorker} from './delivery/delivery.worker'
import {MailerModule} from './mailer/mailer.module'
import {PrismaModule} from './prisma/prisma.module'
import {RedisModule} from './redis/redis.module'

/** The worker process (`worker-main.ts`): queues and schedulers, no HTTP and no controllers. */
@Module({
  imports: [PrismaModule, RedisModule, MailerModule, DeliveryModule],
  providers: [DeliveryWorker]
})
export class WorkerModule {}
