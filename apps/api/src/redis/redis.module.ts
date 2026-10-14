import {Global, Inject, Module, type OnModuleDestroy} from '@nestjs/common'
import Redis from 'ioredis'

export const REDIS = Symbol('REDIS')

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      // lazyConnect: the app and DB-free tests boot without Redis; commands connect on first use.
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
          lazyConnect: true,
          maxRetriesPerRequest: 1
        })
    }
  ],
  exports: [REDIS]
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect()
  }
}
