import {INestApplication} from '@nestjs/common'
import {SwaggerModule} from '@nestjs/swagger'

import {buildOpenApiDocument} from './openapi/openapi'

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()
  // Swagger UI only renders the document; schemas come from @shop/shared, not from decorators.
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument())
}
