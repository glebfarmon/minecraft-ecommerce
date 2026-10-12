import {Get, Query} from '@nestjs/common'

import {type AuditPage, type AuditQuery, AuditQuerySchema} from '@shop/shared/access'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {ValibotPipe} from '../common/valibot.pipe'
import {AuditService} from './audit.service'

@AdminController('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  list(@Query(new ValibotPipe(AuditQuerySchema)) q: AuditQuery): Promise<AuditPage> {
    return this.audit.page(q)
  }
}
