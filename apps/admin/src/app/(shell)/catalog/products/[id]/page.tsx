import {ProductEditor} from '@/features/catalog/components/product-editor'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function ProductPage({params}: {params: Promise<{id: string}>}) {
  const me = await requireMe()
  const {id} = await params
  return <ProductEditor id={id} canEdit={hasPermission(me.permissions, 'catalog.write')} />
}
