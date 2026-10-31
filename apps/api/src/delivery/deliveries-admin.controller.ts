import {Get, Param, Post, Query, Req} from '@nestjs/common'

import {
  type AdminDelivery,
  type AdminDeliveryPage,
  type AdminDeliveryQuery,
  AdminDeliveryQuerySchema
} from '@shop/shared/delivery'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {DeliveriesAdminService} from './deliveries-admin.service'

@AdminController('deliveries')
@RequirePermission('delivery.resolve')
export class DeliveriesAdminController {
  constructor(private readonly deliveries: DeliveriesAdminService) {}

  /** Reading needs `order.read`; the method-level permission replaces the class's `delivery.resolve`. */
  @Get()
  @RequirePermission('order.read')
  list(
    @Query(new ValibotPipe(AdminDeliveryQuerySchema)) q: AdminDeliveryQuery
  ): Promise<AdminDeliveryPage> {
    return this.deliveries.page(q)
  }

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
