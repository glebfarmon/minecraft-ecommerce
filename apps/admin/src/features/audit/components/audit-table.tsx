'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {SkeletonRows} from '@/components/skeleton'
import {type GetApiAdminAuditApiArg, useGetApiAdminAuditQuery} from '@/lib/api/generated'
import {formatTime} from '@/lib/format'
import {ScrollText} from 'lucide-react'
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
  const page = useGetApiAdminAuditQuery({...query, cursor})
  if (page.isLoading) return <SkeletonRows />
  if (page.isError || !page.data)
    return (
      <p role="alert" className="rounded-card bg-card p-5">
        {(page.error as {status?: unknown} | undefined)?.status === 403
          ? 'You do not have permission to read the audit log.'
          : 'Could not load the audit log. Try again.'}
      </p>
    )
  const next = page.data.nextCursor
  return (
    <>
      <DataTable
        caption="Audit log"
        rows={page.data.entries}
        rowKey={e => e.id}
        columns={[
          {header: 'Action', primary: true, cell: e => e.action, className: 'font-mono'},
          {header: 'Time', cell: e => formatTime(e.createdAt), className: 'tabular text-muted'},
          {header: 'Actor', cell: e => e.actor?.email ?? 'System'},
          {
            header: 'Entity',
            cell: e => (e.entityType ? `${e.entityType} ${e.entityId ?? ''}`.trim() : '—')
          },
          {
            header: 'Details',
            cell: e => (
              <details>
                <summary className="cursor-pointer text-muted hover:text-fg">
                  Before / after
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
        empty={isFirst ? <EmptyState icon={ScrollText} title="Nothing logged yet." /> : null}
      />
      {isLast && next && (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          onClick={() => {
            onMore(next)
          }}>
          Load more
        </Button>
      )}
    </>
  )
}

export function AuditTable() {
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
          <Label htmlFor="audit-action">Action starts with</Label>
          <Input
            id="audit-action"
            placeholder="role."
            value={draft.action}
            onChange={e => {
              setDraft(d => ({...d, action: e.target.value}))
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-from">From</Label>
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
          <Label htmlFor="audit-to">To</Label>
          <Input
            id="audit-to"
            type="date"
            value={draft.to}
            onChange={e => {
              setDraft(d => ({...d, to: e.target.value}))
            }}
          />
        </div>
        <Button type="submit">Apply filters</Button>
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
