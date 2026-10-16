import {ContentTabs} from '@/features/content/components/content-tabs'
import {TextsTable} from '@/features/content/components/texts-table'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function ContentTextsTablePage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'content.write')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Texts</h1>
      <ContentTabs current="/content/texts" />
      <TextsTable />
    </section>
  )
}
