import {HomeView} from '@/app/[locale]/_components/home-view'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {findServer} from '@/lib/catalog'
import {notFound} from 'next/navigation'

export default async function ServerPage({params}: {params: Promise<{server: string}>}) {
  const {server} = await params
  if (!findServer(server)) notFound()
  return <HomeView server={server} settings={await getSiteSettings()} />
}
