import {HomeView} from '@/app/[locale]/_components/home-view'
import {defaultServer} from '@/config/servers'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'

export default async function HomePage() {
  return <HomeView server={defaultServer.slug} settings={await getSiteSettings()} />
}
