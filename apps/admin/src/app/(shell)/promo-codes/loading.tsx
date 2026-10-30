import {PageEnter} from '@/components/page-enter'
import {PageHeader} from '@/components/page-header'
import {Skeleton} from '@/components/skeleton'
import {PromoTable} from '@/features/promo/components/promo-table'
import {getTranslations} from 'next-intl/server'

export default async function PromoCodesLoading() {
  const t = await getTranslations('promo')
  return (
    <PageEnter>
      <section className="flex flex-col gap-6">
        <PageHeader
          title={t('title')}
          description={t('description')}
          actions={<Skeleton className="h-9 w-28 rounded-full" />}
        />
        <PromoTable skeleton />
      </section>
    </PageEnter>
  )
}
