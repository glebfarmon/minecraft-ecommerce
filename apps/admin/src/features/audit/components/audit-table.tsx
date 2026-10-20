'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {SkeletonRows} from '@/components/skeleton'
import {useFormat} from '@/hooks/use-format'
import {type GetApiAdminAuditApiArg, useGetApiAdminAuditQuery} from '@/lib/api/generated'
import {ScrollText} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

type Filters = {action: string; from: string; to: string}
const NO_FILTERS: Filters = {action: '', from: '', to: ''}

/** Whole days in UTC: the "to" day is included up to its last millisecond. */
function toQuery(f: Filters): Omit<GetApiAdminAuditApiArg, 'cursor'> {
  return {
    action: f.action.trim() || undefined,
    from: f.from ? `${f.from}T00:00:00.000Z` : undefined,
    to: f.to ? `${f.to}T23:59:59.999Z` : undefined
  }
}

function PageRows({
  query,
  cursor,
  isFirst,
  isLast,
  onMore
}: {
  query: Omit<GetApiAdminAuditApiArg, 'cursor'>
  cursor: string | undefined
  isFirst: boolean
  isLast: boolean
  onMore: (cursor: string) => void
}) {
  const t = useTranslations('audit')
  const f = useFormat()
  const page = useGetApiAdminAuditQuery({...query, cursor})
  if (page.isLoading) return <SkeletonRows />
  if (page.isError || !page.data)
    return (
      <p role="alert" className="rounded-card bg-card p-5">
        {(page.error as {status?: unknown} | undefined)?.status === 403
          ? t('forbidden')
          : t('loadFailed')}
      </p>
    )
  const next = page.data.nextCursor
  return (
    <>
      <DataTable
        caption={t('auditLog')}
        rows={page.data.entries}
        rowKey={e => e.id}
        columns={[
          {header: t('action'), primary: true, cell: e => e.action, className: 'font-mono'},
          {header: t('time'), cell: e => f.time(e.createdAt), className: 'tabular text-muted'},
          {header: t('actor'), cell: e => e.actor?.email ?? t('system')},
          {
            header: t('entity'),
            cell: e => (e.entityType ? `${e.entityType} ${e.entityId ?? ''}`.trim() : '—')
          },
          {
            header: t('details'),
            cell: e => (
              <details>
                <summary className="cursor-pointer text-muted hover:text-fg">
                  {t('beforeAfter')}
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-plate bg-card-raised p-3 font-mono text-[11px] whitespace-pre">
                  {JSON.stringify(
                    {before: e.before as unknown, after: e.after as unknown, ip: e.ip},
                    null,
                    2
                  )}
                </pre>
              </details>
            )
          }
        ]}
        empty={isFirst ? <EmptyState icon={ScrollText} title={t('nothingLoggedYet')} /> : null}
      />
      {isLast && next && (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          onClick={() => {
            onMore(next)
          }}>
          {t('loadMore')}
        </Button>
      )}
    </>
  )
}

export function AuditTable() {
  const t = useTranslations('audit')
  const [draft, setDraft] = useState<Filters>(NO_FILTERS)
  const [applied, setApplied] = useState<Filters>(NO_FILTERS)
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const query = toQuery(applied)

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-card bg-card p-4"
        onSubmit={e => {
          e.preventDefault()
          setApplied(draft)
          setCursors([undefined])
        }}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-action">{t('actionStartsWith')}</Label>
          <Input
            id="audit-action"
            placeholder={t('role')}
            value={draft.action}
            onChange={e => {
              setDraft(d => ({...d, action: e.target.value}))
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-from">{t('from')}</Label>
          <Input
            id="audit-from"
            type="date"
            value={draft.from}
            onChange={e => {
              setDraft(d => ({...d, from: e.target.value}))
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-to">{t('to')}</Label>
          <Input
            id="audit-to"
            type="date"
            value={draft.to}
            onChange={e => {
              setDraft(d => ({...d, to: e.target.value}))
            }}
          />
        </div>
        <Button type="submit">{t('applyFilters')}</Button>
      </form>
      <div className="flex flex-col gap-2">
        {cursors.map((cursor, i) => (
          <PageRows
            key={cursor ?? 'first'}
            query={query}
            cursor={cursor}
            isFirst={i === 0}
            isLast={i === cursors.length - 1}
            onMore={next => {
              setCursors(c => [...c, next])
            }}
          />
        ))}
      </div>
    </div>
  )
}
