import {HomeView} from '@/app/[locale]/_components/home-view'
import {servers} from '@/config/servers'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {findServer} from '@/lib/catalog'
import {notFound} from 'next/navigation'

export function generateStaticParams() {
  return servers.map(s => ({server: s.slug}))
}

export default async function ServerPage({params}: {params: Promise<{server: string}>}) {
  const {server} = await params
  if (!findServer(server)) notFound()
  return <HomeView server={server} settings={await getSiteSettings()} />
}
