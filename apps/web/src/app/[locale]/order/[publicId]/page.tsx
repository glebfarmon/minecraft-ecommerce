import {Footer} from '@/app/[locale]/_components/footer'
import {loadCatalog} from '@/features/catalog/api/get-catalog'
import {getOrder} from '@/features/order/api/get-order'
import {OrderStatus} from '@/features/order/components/order-status'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {routing} from '@/i18n/routing'
import type {Metadata} from 'next'
import {hasLocale} from 'next-intl'
import {getTranslations} from 'next-intl/server'
import {notFound} from 'next/navigation'
import {connection} from 'next/server'

import {PUBLIC_ID_PATTERN} from '@shop/shared/orders'

type Params = Promise<{locale: string; publicId: string}>

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const {locale, publicId} = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({locale, namespace: 'order'})
  return {title: t('title', {publicId}), robots: {index: false}}
}

export default async function OrderPage({params}: {params: Params}) {
  await connection()
  const {locale, publicId} = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  if (!PUBLIC_ID_PATTERN.test(publicId)) notFound()
  const [order, t, settings, catalog] = await Promise.all([
    getOrder(publicId),
    getTranslations({locale, namespace: 'order'}),
    getSiteSettings(),
    loadCatalog(locale)
  ])
  if (!order) notFound()

  return (
    <>
      <main id="shop" className="mx-auto max-w-page px-[var(--gutter)] pt-36 pb-24">
        <h1 className="font-mono text-sm text-muted">{t('title', {publicId})}</h1>
        <div className="mt-6">
          <OrderStatus initial={order} />
        </div>
      </main>
      <Footer settings={settings} servers={catalog?.servers ?? []} />
    </>
  )
}
