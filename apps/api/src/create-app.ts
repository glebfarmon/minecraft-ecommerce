import type {Server} from 'node:http'

import type {INestApplication, Type} from '@nestjs/common'
import {NestFactory} from '@nestjs/core'

import {AppModule} from './app.module'
import {configureApp} from './configure-app'

/**
 * Better Auth reads the raw request body, so Nest's own body parser is off; the integration
 * re-adds JSON and URL-encoded parsing for every route outside /api/auth.
 * `rootModule` lets tests wrap AppModule with test-only controllers.
 */
export async function createApp(rootModule: Type = AppModule): Promise<INestApplication<Server>> {
  const app = await NestFactory.create<INestApplication<Server>>(rootModule, {
    bodyParser: false
  })
  configureApp(app)
  return app
}
