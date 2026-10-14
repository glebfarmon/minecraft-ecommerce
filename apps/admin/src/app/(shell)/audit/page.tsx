import {AuditTable} from '@/features/audit/components/audit-table'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function AuditPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'audit.read')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <AuditTable />
    </section>
  )
}
