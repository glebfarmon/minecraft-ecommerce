import {OrdersTable} from '@/features/orders/components/orders-table'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function OrdersPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'order.read')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <OrdersTable />
    </section>
  )
}
