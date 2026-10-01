import {HomeView} from '@/app/[locale]/_components/home-view'
import {defaultServer} from '@/lib/catalog'

export default function HomePage() {
  return <HomeView server={defaultServer.slug} />
}
