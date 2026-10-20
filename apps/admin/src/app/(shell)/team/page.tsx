import {PageHeader} from '@/components/page-header'
import {AdminsTable} from '@/features/team/components/admins-table'
import {InvitesPanel} from '@/features/team/components/invites-panel'
import {RolesMatrix} from '@/features/team/components/roles-matrix'
import {requireMe} from '@/lib/session'
import {getTranslations} from 'next-intl/server'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@shop/ui/tabs'

export default async function TeamPage() {
  const t = await getTranslations('team')
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'admin.invite')) notFound()
  const canChangeRoles = hasPermission(me.permissions, 'role.write')
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('team')} description={t('adminsInvitesAndRolePermissions')} />
      <Tabs defaultValue="admins">
        <TabsList>
          <TabsTrigger value="admins">{t('admins')}</TabsTrigger>
          <TabsTrigger value="invites">{t('invites')}</TabsTrigger>
          <TabsTrigger value="roles">{t('roles')}</TabsTrigger>
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
