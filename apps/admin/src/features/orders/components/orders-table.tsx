'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {SkeletonRows} from '@/components/skeleton'
import {StatusDot} from '@/components/status-dot'
import {useFormat} from '@/hooks/use-format'
import {type ListAdminOrdersApiArg, useListAdminOrdersQuery} from '@/lib/api/generated'
import {copyText} from '@/lib/copy'
import {ReceiptText, Search} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Tabs, TabsList, TabsTrigger} from '@shop/ui/tabs'

type Query = Omit<ListAdminOrdersApiArg, 'cursor'>
type Status = NonNullable<Query['status']>

// "Problem" (refunds, disputes, failed deliveries) arrives with delivery (5a).
const TABS: (Status | 'ALL')[] = ['ALL', 'PAID', 'DELIVERED', 'PENDING', 'EXPIRED']

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
  const t = useTranslations('orders')
  const tc = useTranslations('common')
  const f = useFormat()
  const router = useRouter()
  const page = useListAdminOrdersQuery({...query, cursor})
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
        caption={t('title')}
        rows={page.data.orders}
        rowKey={o => o.id}
        rowLabel={o => o.publicId}
        rowHref={o => `/orders/${o.id}`}
        columns={[
          {
            header: t('colOrder'),
            primary: true,
            cell: o => <span className="font-mono">{o.publicId}</span>
          },
          {header: t('colDate'), cell: o => f.time(o.createdAt), className: 'tabular text-muted'},
          {header: t('colNick'), cell: o => o.nick},
          {header: t('colEmail'), cell: o => o.email},
          {
            header: t('colTotal'),
            cell: o => f.money(o.totalMinor, o.currency),
            className: 'tabular text-right'
          },
          {header: t('colStatus'), cell: o => <StatusDot status={o.status} />}
        ]}
        menu={o => [
          {
            label: t('open'),
            onSelect: () => {
              router.push(`/orders/${o.id}`)
            }
          },
          {
            label: t('copyNumber'),
            onSelect: () => {
              void copyText(o.publicId, t('orderNumberLabel'), tc)
            }
          },
          {
            label: t('copyEmail'),
            onSelect: () => {
              void copyText(o.email, t('emailLabel'), tc)
            }
          }
        ]}
        empty={isFirst ? <EmptyState icon={ReceiptText} title={t('empty')} /> : null}
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

export function OrdersTable({initialQ = ''}: {initialQ?: string}) {
  const t = useTranslations('orders')
  const status_ = useTranslations('status')
  const [draft, setDraft] = useState(initialQ)
  const [q, setQ] = useState(initialQ)
  const [status, setStatus] = useState<Status | undefined>(undefined)
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const query: Query = {q: q.trim() || undefined, status}

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* min-w-0: as a flex item the root would not shrink, so the list could never scroll. */}
        <Tabs
          className="max-w-full min-w-0"
          value={status ?? 'ALL'}
          onValueChange={v => {
            setStatus(v === 'ALL' ? undefined : (v as Status))
            setCursors([undefined])
          }}>
          <TabsList aria-label={t('status')} className="max-w-full overflow-x-auto">
            {TABS.map(tab => (
              <TabsTrigger key={tab} value={tab}>
                {tab === 'ALL' ? t('all') : status_(tab)}
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
            {t('searchLabel')}
          </Label>
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              id="orders-q"
              type="search"
              placeholder={t('searchPlaceholder')}
              className="rounded-full pl-10"
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
              }}
            />
          </div>
          <Button type="submit" variant="outline" className="rounded-full">
            {t('search')}
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
