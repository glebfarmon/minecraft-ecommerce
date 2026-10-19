import {CategoriesTable} from '@/features/catalog/components/categories-table'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function CategoriesPage() {
  const me = await requireMe()
  return <CategoriesTable canEdit={hasPermission(me.permissions, 'catalog.write')} />
}
