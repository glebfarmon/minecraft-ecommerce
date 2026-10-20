import {PageHeader} from '@/components/page-header'
import {OrdersTable} from '@/features/orders/components/orders-table'
import {requireMe} from '@/lib/session'
import {getTranslations} from 'next-intl/server'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{q?: string | string[]}>
}) {
  const me = await requireMe()
  const t = await getTranslations('orders')
  if (!hasPermission(me.permissions, 'order.read')) notFound()
  const {q} = await searchParams
  const initialQ = typeof q === 'string' ? q : ''
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      {/* Keyed so a new top-bar search on this page restarts the list with the new query. */}
      <OrdersTable key={initialQ} initialQ={initialQ} />
    </section>
  )
}
