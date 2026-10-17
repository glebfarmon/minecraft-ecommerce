import {Get, Param, Query} from '@nestjs/common'

import {
  type AdminOrder,
  type AdminOrderPage,
  type AdminOrderQuery,
  AdminOrderQuerySchema,
  type OrderStats,
  type OrderStatsQuery,
  OrderStatsQuerySchema
} from '@shop/shared/orders'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {ValibotPipe} from '../common/valibot.pipe'
import {OrdersAdminService} from './orders-admin.service'
import {OrdersStatsService} from './orders-stats.service'

@AdminController('orders')
export class OrdersAdminController {
  constructor(private readonly orders: OrdersAdminService) {}

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
