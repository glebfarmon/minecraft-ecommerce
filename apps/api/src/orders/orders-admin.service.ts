import {Injectable} from '@nestjs/common'

import type {AdminOrder, AdminOrderPage, AdminOrderQuery} from '@shop/shared/orders'

import {notFound} from '../common/http-errors'
import type {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {ORDER_ITEMS_WITH_DELIVERY, toAdminOrder} from './order-view'

const PAGE = 50

@Injectable()
export class OrdersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async page(query: AdminOrderQuery): Promise<AdminOrderPage> {
    const q = query.q
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      ...(q
        ? {
            OR: [
              {nick: {startsWith: q, mode: 'insensitive'}},
              {email: {equals: q, mode: 'insensitive'}},
              {publicId: q}
            ]
          }
        : {})
    }
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
      take: PAGE + 1,
      ...(query.cursor ? {cursor: {id: query.cursor}, skip: 1} : {})
    })
    const orders = rows.slice(0, PAGE).map(r => ({
      id: r.id,
      publicId: r.publicId,
      createdAt: r.createdAt.toISOString(),
      nick: r.nick,
      email: r.email,
      currency: r.currency,
      totalMinor: r.totalMinor,
      status: r.status,
      needsAttention: false
    }))
    return {
      orders,
      nextCursor: rows.length > PAGE ? (orders.at(-1)?.id ?? null) : null,
      attentionCount: 0
    }
  }

  async get(id: string): Promise<AdminOrder> {
    const order = await this.prisma.order.findUnique({
      where: {id},
      include: ORDER_ITEMS_WITH_DELIVERY
    })
    if (!order) throw notFound()
    return toAdminOrder(order)
  }
}
