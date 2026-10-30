import {Injectable} from '@nestjs/common'

import type {AdminOrder, AdminOrderPage, AdminOrderQuery} from '@shop/shared/orders'

import {notFound} from '../common/http-errors'
import type {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {ORDER_ITEMS_WITH_ADMIN_DELIVERY, toAdminOrder} from './order-view'

const PAGE = 50
const NEEDS_HUMAN = ['FAILED', 'NEEDS_REVIEW'] as const

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
    const page = rows.slice(0, PAGE)
    const [stuck, attentionCount] = await Promise.all([
      this.stuckAmong(page.map(r => r.id)),
      this.attentionCount()
    ])
    const orders = page.map(r => ({
      id: r.id,
      publicId: r.publicId,
      createdAt: r.createdAt.toISOString(),
      nick: r.nick,
      email: r.email,
      currency: r.currency,
      totalMinor: r.totalMinor,
      status: r.status,
      needsAttention: stuck.has(r.id)
    }))
    return {
      orders,
      nextCursor: rows.length > PAGE ? (orders.at(-1)?.id ?? null) : null,
      attentionCount
    }
  }

  async get(id: string): Promise<AdminOrder> {
    const order = await this.prisma.order.findUnique({
      where: {id},
      include: ORDER_ITEMS_WITH_ADMIN_DELIVERY
    })
    if (!order) throw notFound()
    return toAdminOrder(order)
  }

  /** Which of these orders have a delivery a human has to look at. */
  private async stuckAmong(orderIds: string[]): Promise<Set<string>> {
    const rows = await this.prisma.orderItem.findMany({
      where: {orderId: {in: orderIds}, deliveries: {some: {status: {in: [...NEEDS_HUMAN]}}}},
      select: {orderId: true}
    })
    return new Set(rows.map(r => r.orderId))
  }

  /** Orders (not deliveries) with a stuck delivery, over the whole table and ignoring the filters. */
  private async attentionCount(): Promise<number> {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['orderId'],
      where: {deliveries: {some: {status: {in: [...NEEDS_HUMAN]}}}}
    })
    return rows.length
  }
}
