import {PageHeader} from '@/components/page-header'
import {ContentTabs} from '@/features/content/components/content-tabs'
import {SettingsForm} from '@/features/content/components/settings-form'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function ContentSettingsFormPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'content.write')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="Content" description="Site name, server address and contact links." />
      <ContentTabs current="/content/settings" />
      <SettingsForm canEdit />
    </section>
  )
}
