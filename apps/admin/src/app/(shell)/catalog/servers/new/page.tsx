import {ServerEditor} from '@/features/catalog/components/server-editor'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function NewServerPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'catalog.write')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New server</h1>
      <ServerEditor canEdit canRcon={false} />
    </section>
  )
}
