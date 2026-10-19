'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {SkeletonRows} from '@/components/skeleton'
import {StatusDot} from '@/components/status-dot'
import {type ListAdminOrdersApiArg, useListAdminOrdersQuery} from '@/lib/api/generated'
import {formatMoney, formatTime} from '@/lib/format'
import {ReceiptText, Search} from 'lucide-react'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Tabs, TabsList, TabsTrigger} from '@shop/ui/tabs'

type Query = Omit<ListAdminOrdersApiArg, 'cursor'>
type Status = NonNullable<Query['status']>

// "Problem" (refunds, disputes, failed deliveries) arrives with delivery (5a).
const TABS: {value: Status | 'ALL'; label: string}[] = [
  {value: 'ALL', label: 'All'},
  {value: 'PAID', label: 'Paid'},
  {value: 'DELIVERED', label: 'Delivered'},
  {value: 'PENDING', label: 'Pending'},
  {value: 'EXPIRED', label: 'Expired'}
]

function PageRows({
  query,
  cursor,
  isFirst,
  isLast,
  onMore
}: {
  query: Query
  cursor: string | undefined
  isFirst: boolean
  isLast: boolean
  onMore: (cursor: string) => void
}) {
  const router = useRouter()
  const page = useListAdminOrdersQuery({...query, cursor})
  if (page.isLoading) return <SkeletonRows />
  if (page.isError || !page.data)
    return (
      <p role="alert" className="rounded-card bg-card p-5">
        {(page.error as {status?: unknown} | undefined)?.status === 403
          ? 'You do not have permission to read orders.'
          : 'Could not load orders. Try again.'}
      </p>
    )
  const next = page.data.nextCursor
  return (
    <>
      <DataTable
        caption="Orders"
        rows={page.data.orders}
        rowKey={o => o.id}
        rowLabel={o => o.publicId}
        rowHref={o => `/orders/${o.id}`}
        columns={[
          {
            header: 'Order',
            primary: true,
            cell: o => <span className="font-mono">{o.publicId}</span>
          },
          {header: 'Date', cell: o => formatTime(o.createdAt), className: 'tabular text-muted'},
          {header: 'Nick', cell: o => o.nick},
          {header: 'Email', cell: o => o.email},
          {
            header: 'Total',
            cell: o => formatMoney(o.totalMinor, o.currency),
            className: 'tabular text-right'
          },
          {header: 'Status', cell: o => <StatusDot status={o.status} />}
        ]}
        menu={o => [
          {
            label: 'Open',
            onSelect: () => {
              router.push(`/orders/${o.id}`)
            }
          },
          {
            label: 'Copy order number',
            onSelect: () => {
              void navigator.clipboard.writeText(o.publicId)
            }
          },
          {
            label: 'Copy email',
            onSelect: () => {
              void navigator.clipboard.writeText(o.email)
            }
          }
        ]}
        empty={isFirst ? <EmptyState icon={ReceiptText} title="No orders found." /> : null}
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

export function OrdersTable({initialQ = ''}: {initialQ?: string}) {
  const [draft, setDraft] = useState(initialQ)
  const [q, setQ] = useState(initialQ)
  const [status, setStatus] = useState<Status | undefined>(undefined)
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const query: Query = {q: q.trim() || undefined, status}

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status ?? 'ALL'}
          onValueChange={v => {
            setStatus(v === 'ALL' ? undefined : (v as Status))
            setCursors([undefined])
          }}>
          <TabsList aria-label="Status">
            {TABS.map(t => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form
          role="search"
          className="flex w-full max-w-md gap-2"
          onSubmit={e => {
            e.preventDefault()
            setQ(draft)
            setCursors([undefined])
          }}>
          <Label htmlFor="orders-q" className="sr-only">
            Search by nick, email or order number
          </Label>
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              id="orders-q"
              type="search"
              placeholder="Nick, email or order number"
              className="rounded-full pl-10"
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
              }}
            />
          </div>
          <Button type="submit" variant="outline" className="rounded-full">
            Search
          </Button>
        </form>
      </div>
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
