import {PageEnter} from '@/components/page-enter'
import {PageHeader} from '@/components/page-header'
import {DeliveriesTable} from '@/features/deliveries/components/deliveries-table'
import {getTranslations} from 'next-intl/server'

export default async function DeliveriesLoading() {
  const t = await getTranslations('deliveries')
  return (
    <PageEnter>
      <section className="flex flex-col gap-6">
        <PageHeader title={t('title')} description={t('description')} />
        <DeliveriesTable canResolve={false} skeleton />
      </section>
    </PageEnter>
  )
}
