import {Param, Post, Req} from '@nestjs/common'

import type {AdminDelivery} from '@shop/shared/delivery'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {DeliveriesAdminService} from './deliveries-admin.service'

@AdminController('deliveries')
@RequirePermission('delivery.resolve')
export class DeliveriesAdminController {
  constructor(private readonly deliveries: DeliveriesAdminService) {}

  @Post(':id/retry')
  @Audited('delivery.retry', 'delivery')
  retry(@Param('id') id: string, @Req() req: AuditableRequest): Promise<AdminDelivery> {
    return this.deliveries.retry(id, before => {
      req.auditBefore = before
    })
  }

  @Post(':id/mark-done')
  @Audited('delivery.mark_done', 'delivery')
  markDone(@Param('id') id: string, @Req() req: AuditableRequest): Promise<AdminDelivery> {
    return this.deliveries.markDone(id, before => {
      req.auditBefore = before
    })
  }
}
