import {PageHeader} from '@/components/page-header'
import {AuditTable} from '@/features/audit/components/audit-table'
import {requireMe} from '@/lib/session'
import {getTranslations} from 'next-intl/server'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function AuditPage() {
  const t = await getTranslations('audit')
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'audit.read')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('auditLog')} description={t('whoChangedWhatNewestFirst')} />
      <AuditTable />
    </section>
  )
}
