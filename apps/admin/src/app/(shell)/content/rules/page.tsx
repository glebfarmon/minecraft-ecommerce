import {ContentTabs} from '@/features/content/components/content-tabs'
import {RulesEditor} from '@/features/content/components/rules-editor'
import {VersionsList} from '@/features/content/components/versions-list'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function ContentRulesPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'content.write')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Rules</h1>
      <ContentTabs current="/content/rules" />
      <RulesEditor />
      <VersionsList />
    </section>
  )
}
