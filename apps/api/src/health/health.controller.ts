import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  version: string;
}

@Controller('health')
export class HealthController {
  @Get()
  get(): HealthResponse {
    return { status: 'ok', version: process.env.APP_VERSION ?? 'dev' };
  }
}
