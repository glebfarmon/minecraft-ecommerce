import {PageHeader} from '@/components/page-header'
import {OrdersTable} from '@/features/orders/components/orders-table'
import {getTranslations} from 'next-intl/server'

export default async function OrdersLoading() {
  const t = await getTranslations('orders')
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <OrdersTable skeleton />
    </section>
  )
}
