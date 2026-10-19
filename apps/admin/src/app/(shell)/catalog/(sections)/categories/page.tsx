import {CategoriesTable} from '@/features/catalog/components/categories-table'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<{edit?: string}>
}) {
  const me = await requireMe()
  const {edit} = await searchParams
  return (
    <CategoriesTable
      key={edit}
      canEdit={hasPermission(me.permissions, 'catalog.write')}
      initialEdit={edit}
    />
  )
}
