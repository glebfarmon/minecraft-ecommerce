import {CategoriesTable} from '@/features/catalog/components/categories-table'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function CategoriesPage() {
  const me = await requireMe()
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <CategoriesTable canEdit={hasPermission(me.permissions, 'catalog.write')} />
    </section>
  )
}
