import {Body, Get, Param, Post, Query, Req} from '@nestjs/common'

import {
  type AdminOrder,
  type AdminOrderPage,
  type AdminOrderQuery,
  AdminOrderQuerySchema,
  type OrderStats,
  type OrderStatsQuery,
  OrderStatsQuerySchema,
  type RefundInput,
  RefundInputSchema
} from '@shop/shared/orders'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {OrdersAdminService} from './orders-admin.service'
import {OrdersRefundService} from './orders-refund.service'
import {OrdersStatsService} from './orders-stats.service'

@AdminController('orders')
export class OrdersAdminController {
  constructor(
    private readonly orders: OrdersAdminService,
    private readonly refunds: OrdersRefundService
  ) {}

  @Get()
  @RequirePermission('order.read')
  list(@Query(new ValibotPipe(AdminOrderQuerySchema)) q: AdminOrderQuery): Promise<AdminOrderPage> {
    return this.orders.page(q)
  }

  @Get(':id')
  @RequirePermission('order.read')
  get(@Param('id') id: string): Promise<AdminOrder> {
    return this.orders.get(id)
  }

  @Post(':id/refund')
  @RequirePermission('order.refund')
  @Audited('order.refund', 'order')
  refund(
    @Param('id') id: string,
    @Body(new ValibotPipe(RefundInputSchema)) body: RefundInput,
    @Req() req: AuditableRequest
  ): Promise<AdminOrder> {
    return this.refunds.refund(id, body.revoke, before => {
      req.auditBefore = before
    })
  }
}

@AdminController('stats')
export class OrderStatsController {
  constructor(private readonly stats: OrdersStatsService) {}

  @Get('orders')
  @RequirePermission('order.read')
  orders(@Query(new ValibotPipe(OrderStatsQuerySchema)) q: OrderStatsQuery): Promise<OrderStats> {
    return this.stats.stats(q)
  }
}
