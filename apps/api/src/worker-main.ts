import {NestFactory} from '@nestjs/core'
import 'reflect-metadata'

import {DeliveryWorker} from './delivery/delivery.worker'
import {WorkerModule} from './worker.module'

/** The `worker` process (ADR 0001, 0011): same image as the API, `node dist/worker-main.js`. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule)
  // SIGTERM (a deploy) / SIGINT: close the worker, letting the running job finish, then the context.
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'])
  await app.get(DeliveryWorker).start()
}

bootstrap().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
