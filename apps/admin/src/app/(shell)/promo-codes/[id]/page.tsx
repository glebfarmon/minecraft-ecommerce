import {PromoEditor} from '@/features/promo/components/promo-editor'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function PromoCodePage({params}: {params: Promise<{id: string}>}) {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'promo.write')) notFound()
  const {id} = await params
  return <PromoEditor id={id} />
}
