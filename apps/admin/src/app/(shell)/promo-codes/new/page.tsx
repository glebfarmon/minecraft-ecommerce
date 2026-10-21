import {PromoEditor} from '@/features/promo/components/promo-editor'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function NewPromoCodePage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'promo.write')) notFound()
  return <PromoEditor />
}
