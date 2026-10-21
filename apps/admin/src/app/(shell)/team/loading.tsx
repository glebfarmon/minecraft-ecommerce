import {PageEnter} from '@/components/page-enter'
import {PageHeader} from '@/components/page-header'
import {AdminsTable} from '@/features/team/components/admins-table'
import {getTranslations} from 'next-intl/server'

import {Tabs, TabsContent, TabsList, TabsTrigger} from '@shop/ui/tabs'

/** The team page's own layout, on its first tab, with placeholder rows. */
export default async function TeamLoading() {
  const t = await getTranslations('team')
  return (
    <PageEnter>
      <section className="flex flex-col gap-6">
        <PageHeader title={t('team')} description={t('adminsInvitesAndRolePermissions')} />
        <Tabs value="admins">
          <TabsList>
            <TabsTrigger value="admins">{t('admins')}</TabsTrigger>
            <TabsTrigger value="invites" disabled>
              {t('invites')}
            </TabsTrigger>
            <TabsTrigger value="roles" disabled>
              {t('roles')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="admins">
            <AdminsTable canChangeRoles={false} skeleton />
          </TabsContent>
        </Tabs>
      </section>
    </PageEnter>
  )
}
