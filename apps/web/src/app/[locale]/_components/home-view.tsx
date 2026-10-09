import {Faq} from '@/app/[locale]/_components/faq'
import {Footer} from '@/app/[locale]/_components/footer'
import {Hero} from '@/app/[locale]/_components/hero'
import {HowItWorks} from '@/app/[locale]/_components/how-it-works'
import {LiveFeed} from '@/app/[locale]/_components/live-feed'
import type {SiteSettings} from '@/config/site'
import {Catalog} from '@/features/catalog/components/catalog'

import type {CatalogResponse} from '@shop/shared/catalog'

export function HomeView({
  server,
  settings,
  catalog
}: {
  server: string
  settings: SiteSettings
  catalog: CatalogResponse | null
}) {
  return (
    <>
      <main>
        <Hero serverIp={settings.serverIp} />
        <Catalog initialServer={server} />
        <HowItWorks />
        <LiveFeed catalog={catalog} />
        <Faq />
      </main>
      <Footer settings={settings} servers={catalog?.servers ?? []} />
    </>
  )
}
