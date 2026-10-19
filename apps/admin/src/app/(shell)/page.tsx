import {PageHeader} from '@/components/page-header'
import {Dashboard} from '@/features/dashboard/components/dashboard'
import {QuickLinks} from '@/features/dashboard/components/quick-links'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function HomePage() {
  const me = await requireMe()
  const stats = hasPermission(me.permissions, 'order.read')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome, ${me.name || me.email}`}
        description={stats ? 'Here is how the shop is doing.' : 'Pick a section to work on.'}
      />
      {stats ? <Dashboard /> : <QuickLinks me={me} />}
    </div>
  )
}
