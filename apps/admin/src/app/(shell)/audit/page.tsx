import {PageHeader} from '@/components/page-header'
import {AuditTable} from '@/features/audit/components/audit-table'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function AuditPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'audit.read')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="Audit log" description="Who changed what, newest first." />
      <AuditTable />
    </section>
  )
}
