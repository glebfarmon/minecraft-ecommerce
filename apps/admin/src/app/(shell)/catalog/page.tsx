import {CatalogBoard} from '@/features/catalog/components/catalog-board'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function CatalogPage() {
  const me = await requireMe()
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Catalog</h1>
      <CatalogBoard canEdit={hasPermission(me.permissions, 'catalog.write')} />
    </section>
  )
}
