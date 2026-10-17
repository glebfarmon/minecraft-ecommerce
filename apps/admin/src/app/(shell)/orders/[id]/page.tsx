import {OrderDetails} from '@/features/orders/components/order-details'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function OrderPage({params}: {params: Promise<{id: string}>}) {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'order.read')) notFound()
  const {id} = await params
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Order</h1>
      <OrderDetails id={id} />
    </section>
  )
}
