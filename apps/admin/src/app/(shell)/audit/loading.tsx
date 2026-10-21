import {PageHeader} from '@/components/page-header'
import {AuditTable} from '@/features/audit/components/audit-table'
import {getTranslations} from 'next-intl/server'

export default async function AuditLoading() {
  const t = await getTranslations('audit')
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('auditLog')} description={t('whoChangedWhatNewestFirst')} />
      <AuditTable skeleton />
    </section>
  )
}
