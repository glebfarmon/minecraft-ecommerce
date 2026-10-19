import {RulesEditor} from '@/features/content/components/rules-editor'
import {VersionsList} from '@/features/content/components/versions-list'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function ContentRulesPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'content.write')) notFound()
  return (
    <div className="flex flex-col gap-6">
      <RulesEditor />
      <VersionsList />
    </div>
  )
}
