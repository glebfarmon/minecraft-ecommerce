import {AdminsTable} from '@/features/team/components/admins-table'
import {InvitesPanel} from '@/features/team/components/invites-panel'
import {RolesMatrix} from '@/features/team/components/roles-matrix'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@shop/ui/tabs'

export default async function TeamPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'admin.invite')) notFound()
  const canChangeRoles = hasPermission(me.permissions, 'role.write')
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Tabs defaultValue="admins">
        <TabsList>
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent value="admins">
          <AdminsTable canChangeRoles={canChangeRoles} held={me.permissions} />
        </TabsContent>
        <TabsContent value="invites">
          <InvitesPanel held={me.permissions} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesMatrix editable={canChangeRoles} held={me.permissions} />
        </TabsContent>
      </Tabs>
    </section>
  )
}
