import {Controller, Get, ServiceUnavailableException} from '@nestjs/common'

import {PrismaService} from '../prisma/prisma.service'

export interface HealthResponse {
  status: 'ok'
  version: string
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process answers. Docker HEALTHCHECK uses this, so a database blip does not restart the API. */
  @Get()
  get(): HealthResponse {
    return {status: 'ok', version: process.env.APP_VERSION ?? 'dev'}
  }

  /** Readiness: the database answers too. */
  @Get('ready')
  async ready(): Promise<{status: 'ok'; database: 'up'}> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({status: 'error', database: 'down'})
    }
    return {status: 'ok', database: 'up'}
  }
}
