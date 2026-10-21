import {PageHeader} from '@/components/page-header'
import {PromoTable} from '@/features/promo/components/promo-table'
import {requireMe} from '@/lib/session'
import {Plus} from 'lucide-react'
import {getTranslations} from 'next-intl/server'
import Link from 'next/link'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'
import {Button} from '@shop/ui/button'

export default async function PromoCodesPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'promo.write')) notFound()
  const t = await getTranslations('promo')
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button asChild>
            <Link href="/promo-codes/new">
              <Plus aria-hidden className="size-4" />
              {t('newCode')}
            </Link>
          </Button>
        }
      />
      <PromoTable />
    </section>
  )
}
