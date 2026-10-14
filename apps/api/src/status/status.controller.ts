import {Controller, Get} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import {ServerStatus, StatusService} from './status.service'

@AllowAnonymous()
@Controller('status')
export class StatusController {
  constructor(private readonly status: StatusService) {}

  @Get()
  get(): Promise<ServerStatus> {
    return this.status.get()
  }
}
