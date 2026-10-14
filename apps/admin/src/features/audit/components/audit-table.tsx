'use client'

import {type GetApiAdminAuditApiArg, useGetApiAdminAuditQuery} from '@/lib/api/generated'
import {useState} from 'react'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@shop/ui/table'

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

const formatTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`

function PageRows({
  query,
  cursor,
  isLast,
  onMore
}: {
  query: Omit<GetApiAdminAuditApiArg, 'cursor'>
  cursor: string | undefined
  isLast: boolean
  onMore: (cursor: string) => void
}) {
  const page = useGetApiAdminAuditQuery({...query, cursor})
  if (page.isLoading)
    return (
      <TableRow>
        <TableCell colSpan={5}>Loading…</TableCell>
      </TableRow>
    )
  if (page.isError || !page.data)
    return (
      <TableRow>
        <TableCell colSpan={5} role="alert">
          {(page.error as {status?: unknown} | undefined)?.status === 403
            ? 'You do not have permission to read the audit log.'
            : 'Could not load the audit log. Try again.'}
        </TableCell>
      </TableRow>
    )
  const next = page.data.nextCursor
  return (
    <>
      {page.data.entries.map(entry => (
        <TableRow key={entry.id}>
          <TableCell>{formatTime(entry.createdAt)}</TableCell>
          <TableCell>{entry.actor?.email ?? 'System'}</TableCell>
          <TableCell>{entry.action}</TableCell>
          <TableCell>
            {entry.entityType ? `${entry.entityType} ${entry.entityId ?? ''}`.trim() : '—'}
          </TableCell>
          <TableCell>
            <details>
              <summary className="cursor-pointer text-sm">Before / after</summary>
              <pre className="mt-2 max-w-md overflow-x-auto text-xs">
                {JSON.stringify(
                  {before: entry.before as unknown, after: entry.after as unknown, ip: entry.ip},
                  null,
                  2
                )}
              </pre>
            </details>
          </TableCell>
        </TableRow>
      ))}
      {isLast && next && (
        <TableRow>
          <TableCell colSpan={5}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onMore(next)
              }}>
              Load more
            </Button>
          </TableCell>
        </TableRow>
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
        className="flex flex-wrap items-end gap-3"
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cursors.map((cursor, i) => (
            <PageRows
              key={cursor ?? 'first'}
              query={query}
              cursor={cursor}
              isLast={i === cursors.length - 1}
              onMore={next => {
                setCursors(c => [...c, next])
              }}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
