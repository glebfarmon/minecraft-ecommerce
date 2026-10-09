import {HomeView} from '@/app/[locale]/_components/home-view'
import {loadCatalog} from '@/features/catalog/api/get-catalog'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {type Locale} from '@/i18n/routing'
import {notFound} from 'next/navigation'

export default async function ServerPage({
  params
}: {
  params: Promise<{locale: Locale; server: string}>
}) {
  const {locale, server} = await params
  const [catalog, settings] = await Promise.all([loadCatalog(locale), getSiteSettings()])
  // Without a catalog the slug cannot be checked: render the page with the shop marked unavailable.
  if (catalog && !catalog.servers.some(s => s.slug === server)) notFound()
  return <HomeView server={server} settings={settings} catalog={catalog} />
}
