import {ServerEditor} from '@/features/catalog/components/server-editor'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function ServerPage({params}: {params: Promise<{id: string}>}) {
  const me = await requireMe()
  const {id} = await params
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Server</h1>
      <ServerEditor
        id={id}
        canEdit={hasPermission(me.permissions, 'catalog.write')}
        canRcon={hasPermission(me.permissions, 'server.rcon')}
      />
    </section>
  )
}
