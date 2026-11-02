import type {Prisma} from '../generated/prisma/client'
import {ORDER_DELIVERY_KINDS} from './delivery-rules'

/**
 * `PAID → DELIVERED` once every GRANT and RESTORE delivery of the order that is not `CANCELLED`
 * is `DONE`; REVOKE rows never count (spec §5.2). The caller already holds the order row lock, so
 * the last two deliveries of one order finishing together cannot both miss it.
 */
export async function settleOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const open = await tx.delivery.count({
    where: {
      orderItem: {orderId},
      kind: {in: [...ORDER_DELIVERY_KINDS]},
      status: {notIn: ['DONE', 'CANCELLED']}
    }
  })
  if (open === 0)
    await tx.order.updateMany({where: {id: orderId, status: 'PAID'}, data: {status: 'DELIVERED'}})
}
