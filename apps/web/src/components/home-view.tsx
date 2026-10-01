import { Catalog } from '@/components/catalog';
import { FairCases } from '@/components/fair-cases';
import { Faq } from '@/components/faq';
import { Footer } from '@/components/footer';
import { Hero } from '@/components/hero';
import { HowItWorks } from '@/components/how-it-works';
import { LiveFeed } from '@/components/live-feed';

export function HomeView({ server }: { server: string }) {
  return (
    <>
      <main>
        <Hero />
        <Catalog initialServer={server} />
        <HowItWorks />
        <FairCases />
        <LiveFeed />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
