import {CatalogBoard} from '@/features/catalog/components/catalog-board'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function CatalogPage() {
  const me = await requireMe()
  return <CatalogBoard canEdit={hasPermission(me.permissions, 'catalog.write')} />
}
