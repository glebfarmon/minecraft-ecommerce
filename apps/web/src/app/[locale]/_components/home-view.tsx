import {Faq} from '@/app/[locale]/_components/faq'
import {Footer} from '@/app/[locale]/_components/footer'
import {Hero} from '@/app/[locale]/_components/hero'
import {HowItWorks} from '@/app/[locale]/_components/how-it-works'
import {LiveFeed} from '@/app/[locale]/_components/live-feed'
import {Catalog} from '@/features/catalog/components/catalog'

export function HomeView({server}: {server: string}) {
  return (
    <>
      <main>
        <Hero />
        <Catalog initialServer={server} />
        <HowItWorks />
        <LiveFeed />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
