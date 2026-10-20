import {PageHeader} from '@/components/page-header'
import {Dashboard} from '@/features/dashboard/components/dashboard'
import {QuickLinks} from '@/features/dashboard/components/quick-links'
import {requireMe} from '@/lib/session'
import {getTranslations} from 'next-intl/server'

import {hasPermission} from '@shop/shared/access'

export default async function HomePage() {
  const me = await requireMe()
  const t = await getTranslations('shell')
  const stats = hasPermission(me.permissions, 'order.read')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('welcome', {name: me.name || me.email})}
        description={stats ? t('homeStats') : t('homePick')}
      />
      {stats ? <Dashboard /> : <QuickLinks me={me} />}
    </div>
  )
}
