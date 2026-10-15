import {ProductEditor} from '@/features/catalog/components/product-editor'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function ProductPage({params}: {params: Promise<{id: string}>}) {
  const me = await requireMe()
  const {id} = await params
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Product</h1>
      <ProductEditor id={id} canEdit={hasPermission(me.permissions, 'catalog.write')} />
    </section>
  )
}
