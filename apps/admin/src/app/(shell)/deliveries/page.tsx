import {PageHeader} from '@/components/page-header'
import {DeliveriesTable} from '@/features/deliveries/components/deliveries-table'
import {requireMe} from '@/lib/session'
import {getTranslations} from 'next-intl/server'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function DeliveriesPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'order.read')) notFound()
  const t = await getTranslations('deliveries')
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <DeliveriesTable canResolve={hasPermission(me.permissions, 'delivery.resolve')} />
    </section>
  )
}
