import {ProductEditor} from '@/features/catalog/components/product-editor'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function NewProductPage({
  searchParams
}: {
  searchParams: Promise<{serverId?: string; categoryId?: string}>
}) {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'catalog.write')) notFound()
  const {serverId, categoryId} = await searchParams
  return <ProductEditor serverId={serverId} categoryId={categoryId} canEdit />
}
