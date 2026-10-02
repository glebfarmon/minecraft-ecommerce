import {Controller, Get} from '@nestjs/common'

import {ServerStatus, StatusService} from './status.service'

@Controller('status')
export class StatusController {
  constructor(private readonly status: StatusService) {}

  @Get()
  get(): Promise<ServerStatus> {
    return this.status.get()
  }
}
