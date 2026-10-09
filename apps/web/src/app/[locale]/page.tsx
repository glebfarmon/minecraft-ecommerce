import {HomeView} from '@/app/[locale]/_components/home-view'
import {loadCatalog} from '@/features/catalog/api/get-catalog'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {type Locale} from '@/i18n/routing'

export default async function HomePage({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params
  // Same fetch as the layout: Next dedupes it within the request.
  const [catalog, settings] = await Promise.all([loadCatalog(locale), getSiteSettings()])
  return <HomeView server={catalog?.servers[0]?.slug ?? ''} settings={settings} catalog={catalog} />
}
