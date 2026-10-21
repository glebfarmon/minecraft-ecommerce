'use client'

import {DataTable} from '@/components/data-table'
import {DateRangePicker} from '@/components/date-range-picker'
import {EmptyState} from '@/components/empty-state'
import {useFormat} from '@/hooks/use-format'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {
  type GetApiAdminAuditApiArg,
  useGetApiAdminAdminsQuery,
  useGetApiAdminAuditQuery
} from '@/lib/api/generated'
import {ChevronLeft, ChevronRight, ScrollText} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useCallback, useEffect, useState} from 'react'

import {AUDIT_PAGE_SIZES, type AuditPageSize} from '@shop/shared/access'
import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'

type Filters = {actorId: string; action: string; from: string; to: string}
const NO_FILTERS: Filters = {actorId: '', action: '', from: '', to: ''}
/** Select options may not be '', so "Anyone" is a sentinel. */
const ANYONE = 'anyone'

/** Whole days in UTC: the "to" day is included up to its last millisecond. */
function toQuery(f: Filters, limit: AuditPageSize): Omit<GetApiAdminAuditApiArg, 'cursor'> {
  return {
    limit: String(limit) as GetApiAdminAuditApiArg['limit'],
    actorId: f.actorId || undefined,
    action: f.action.trim() || undefined,
    from: f.from ? `${f.from}T00:00:00.000Z` : undefined,
    to: f.to ? `${f.to}T23:59:59.999Z` : undefined
  }
}

function PageRows({
  query,
  cursor,
  pageIndex,
  pageSize,
  onPage,
  onPageSize,
  onActors,
  skeleton
}: {
  query: Omit<GetApiAdminAuditApiArg, 'cursor'>
  cursor: string | undefined
  pageIndex: number
  pageSize: AuditPageSize
  onPage: (direction: 1 | -1, nextCursor: string | null) => void
  onPageSize: (size: AuditPageSize) => void
  onActors: (actors: {id: string; email: string}[]) => void
  skeleton: boolean
}) {
  const t = useTranslations('audit')
  const f = useFormat()
  const page = useGetApiAdminAuditQuery({...query, cursor})
  const entries = page.data?.entries
  useEffect(() => {
    if (entries) onActors(entries.flatMap(e => (e.actor ? [e.actor] : [])))
  }, [entries, onActors])
  const held = useHoldLoading(page.isLoading) || skeleton
  if (!held && (page.isError || !page.data))
    return (
      <p role="alert" className="rounded-card bg-card p-5">
        {(page.error as {status?: unknown} | undefined)?.status === 403
          ? t('forbidden')
          : t('loadFailed')}
      </p>
    )
  const next = held ? null : (page.data?.nextCursor ?? null)
  return (
    <>
      <DataTable
        caption={t('auditLog')}
        loading={held ? Math.min(pageSize, 10) : undefined}
        rows={page.data?.entries ?? []}
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
        empty={
          pageIndex === 0 ? <EmptyState icon={ScrollText} title={t('nothingLoggedYet')} /> : null
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="audit-page-size" className="text-muted">
            {t('rowsPerPage')}
          </Label>
          <Select
            id="audit-page-size"
            className="w-20"
            value={String(pageSize)}
            options={AUDIT_PAGE_SIZES.map(n => ({value: String(n), label: String(n)}))}
            onValueChange={v => {
              onPageSize(Number(v) as AuditPageSize)
            }}
          />
        </div>
        <nav aria-label={t('pager')} className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('previousPage')}
            disabled={pageIndex === 0}
            onClick={() => {
              onPage(-1, next)
            }}>
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <span aria-live="polite" className="tabular text-sm text-muted">
            {t('page', {n: pageIndex + 1})}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('nextPage')}
            disabled={!next}
            onClick={() => {
              onPage(1, next)
            }}>
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </nav>
      </div>
    </>
  )
}

/** `skeleton`: the route's loading state, this layout with placeholders. */
export function AuditTable({skeleton = false}: {skeleton?: boolean}) {
  const t = useTranslations('audit')
  const [draft, setDraft] = useState<Filters>(NO_FILTERS)
  const [applied, setApplied] = useState<Filters>(NO_FILTERS)
  /** cursors[i] is the cursor of page i; kept so Previous reuses the cached page. */
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)
  const [seen, setSeen] = useState<Record<string, string>>({})
  const [pageSize, setPageSize] = useState<AuditPageSize>(50)
  const query = toQuery(applied, pageSize)
  // The admins list needs admin.invite, which an auditor may lack: then the options are the
  // actors seen in the pages loaded so far.
  const admins = useGetApiAdminAdminsQuery()
  const actors = admins.data
    ? admins.data.map(a => ({id: a.id, email: a.email}))
    : Object.entries(seen).map(([id, email]) => ({id, email}))
  const actorOptions = [
    {value: ANYONE, label: t('anyone')},
    ...actors.map(a => ({value: a.id, label: a.email}))
  ]

  const rememberActors = useCallback((found: {id: string; email: string}[]) => {
    setSeen(prev => {
      const missing = found.filter(a => prev[a.id] !== a.email)
      return missing.length
        ? {...prev, ...Object.fromEntries(missing.map(a => [a.id, a.email]))}
        : prev
    })
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-card bg-card p-4"
        onSubmit={e => {
          e.preventDefault()
          setApplied(draft)
          setCursors([undefined])
          setPageIndex(0)
        }}>
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="audit-actor">{t('actor')}</Label>
          <Select
            id="audit-actor"
            className="w-56 max-w-full"
            value={draft.actorId || ANYONE}
            options={actorOptions}
            onValueChange={v => {
              setDraft(d => ({...d, actorId: v === ANYONE ? '' : v}))
            }}
          />
        </div>
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
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="audit-dates">{t('dates')}</Label>
          <DateRangePicker
            id="audit-dates"
            className="w-64 max-w-full"
            value={{from: draft.from, to: draft.to}}
            onChange={range => {
              setDraft(d => ({...d, ...range}))
            }}
          />
        </div>
        <Button type="submit">{t('applyFilters')}</Button>
      </form>
      <div className="flex flex-col gap-4">
        <PageRows
          key={`${String(pageIndex)}:${cursors[pageIndex] ?? 'first'}`}
          query={query}
          cursor={cursors[pageIndex]}
          pageIndex={pageIndex}
          pageSize={pageSize}
          skeleton={skeleton}
          onPageSize={size => {
            // Cursors belong to a page size: start over from the first page.
            setPageSize(size)
            setCursors([undefined])
            setPageIndex(0)
          }}
          onActors={rememberActors}
          onPage={(direction, nextCursor) => {
            if (direction === -1) {
              setPageIndex(i => Math.max(0, i - 1))
              return
            }
            if (!nextCursor) return
            setCursors(c => [...c.slice(0, pageIndex + 1), nextCursor])
            setPageIndex(i => i + 1)
          }}
        />
      </div>
    </div>
  )
}
