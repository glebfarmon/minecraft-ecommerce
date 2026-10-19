import {ServerEditor} from '@/features/catalog/components/server-editor'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function NewServerPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'catalog.write')) notFound()
  return <ServerEditor canEdit canRcon={false} />
}
