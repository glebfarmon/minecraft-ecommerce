import {PageEnter} from '@/components/page-enter'
import {PageHeader} from '@/components/page-header'
import {Skeleton} from '@/components/skeleton'
import {Dashboard} from '@/features/dashboard/components/dashboard'
import {getTranslations} from 'next-intl/server'

/** The home page's own layout: the greeting names the admin, so it waits as a placeholder. */
export default async function HomeLoading() {
  const t = await getTranslations('shell')
  return (
    <PageEnter>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={<Skeleton className="my-[3px] h-7 w-64 max-w-full rounded-full" />}
          description={t('homeStats')}
        />
        <Dashboard skeleton />
      </div>
    </PageEnter>
  )
}
