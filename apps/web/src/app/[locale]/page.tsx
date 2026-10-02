import {HomeView} from '@/app/[locale]/_components/home-view'
import {defaultServer} from '@/config/servers'

export default function HomePage() {
  return <HomeView server={defaultServer.slug} />
}
