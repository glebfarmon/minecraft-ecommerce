import 'reflect-metadata'

import {createApp} from './create-app'

async function bootstrap(): Promise<void> {
  const app = await createApp()
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0')
}

void bootstrap()
