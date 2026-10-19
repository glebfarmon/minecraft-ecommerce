'use client'

import {Card} from '@/components/card'
import {DataTable} from '@/components/data-table'
import {DayChart} from '@/components/day-chart'
import {EmptyState} from '@/components/empty-state'
import {KpiCard} from '@/components/kpi-card'
import {Ring} from '@/components/ring'
import {Skeleton, SkeletonRows} from '@/components/skeleton'
import {StatusDot} from '@/components/status-dot'
import {
  type GetOrderStatsApiResponse,
  useGetOrderStatsQuery,
  useListAdminOrdersQuery
} from '@/lib/api/generated'
import {delta, formatMoney, formatPercent} from '@/lib/format'
import {PackageOpen, ReceiptText} from 'lucide-react'
import Link from 'next/link'
import {useState} from 'react'

import {CURRENCIES, type Currency} from '@shop/shared/catalog'
import {Button} from '@shop/ui/button'
import {Tabs, TabsList, TabsTrigger} from '@shop/ui/tabs'

type Range = '7d' | '30d'
type Stats = GetOrderStatsApiResponse

const LINK =
  'text-[13px] text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] rounded-full'

function dailyFor(stats: Stats, currency: Currency) {
  return stats.daily
    .filter(d => d.currency === currency)
    .map(d => ({day: d.day, value: d.totalMinor}))
}

function paidPerDay(stats: Stats) {
  const byDay = new Map<string, number>()
  for (const d of stats.daily) byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.paidCount)
  return [...byDay.values()]
}

function RevenueKpi({stats, currency}: {stats: Stats; currency: Currency}) {
  const r = stats.revenue.find(x => x.currency === currency) ?? {totalMinor: 0, previousMinor: 0}
  return (
    <KpiCard
      label={`Revenue ${currency}`}
      value={formatMoney(r.totalMinor, currency)}
      delta={delta(r.totalMinor, r.previousMinor)}
      hint="vs previous period"
      tone={currency === 'EUR' ? 'accent' : 'default'}
      spark={dailyFor(stats, currency).map(d => d.value)}
    />
  )
}

function RevenueChart({stats}: {stats: Stats}) {
  const [currency, setCurrency] = useState<Currency>('EUR')
  return (
    <Card
      title="Revenue per day"
      action={
        <Tabs
          value={currency}
          onValueChange={v => {
            setCurrency(v as Currency)
          }}>
          <TabsList aria-label="Currency">
            {CURRENCIES.map(c => (
              <TabsTrigger key={c} value={c}>
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }>
      <DayChart
        days={dailyFor(stats, currency)}
        label="Revenue per day"
        format={n => formatMoney(n, currency)}
      />
    </Card>
  )
}

function StatusCard({stats}: {stats: Stats}) {
  const statuses = stats.byStatus.filter(s => s.count > 0)
  return (
    <Card title="Orders by status">
      {statuses.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No orders in this range." />
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <Ring value={stats.conversion} label="Conversion" />
          <ul className="flex flex-col gap-2">
            {statuses.map(s => (
              <li key={s.status} className="flex items-center gap-3">
                <StatusDot status={s.status} />
                <span className="tabular font-semibold">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function TopProducts({stats}: {stats: Stats}) {
  return (
    <Card title="Top products">
      {stats.topProducts.length === 0 ? (
        <EmptyState icon={PackageOpen} title="No sales in this range." />
      ) : (
        <ol className="flex flex-col gap-1.5">
          {stats.topProducts.map((p, i) => (
            <li
              key={p.productId}
              className="flex items-center gap-3 rounded-plate bg-card-raised px-4 py-3 text-[13px]">
              <span className="tabular w-5 text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <span className="hidden truncate text-muted sm:block">{p.serverName}</span>
              <span className="tabular font-semibold">×{p.quantity}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function LatestOrders() {
  const page = useListAdminOrdersQuery({})
  return (
    <Card
      title="Latest orders"
      action={
        <Link href="/orders" className={LINK}>
          View all
        </Link>
      }>
      {page.isLoading ? (
        <SkeletonRows rows={5} />
      ) : page.isError || !page.data ? (
        <p className="text-muted">Could not load orders.</p>
      ) : (
        <DataTable
          caption="Latest orders"
          rows={page.data.orders.slice(0, 5)}
          rowKey={o => o.id}
          columns={[
            {
              header: 'Order',
              primary: true,
              cell: o => (
                <Link href={`/orders/${o.id}`} className="font-mono hover:underline">
                  {o.publicId}
                </Link>
              )
            },
            {header: 'Nick', cell: o => o.nick},
            {header: 'Total', cell: o => formatMoney(o.totalMinor, o.currency)},
            {header: 'Status', cell: o => <StatusDot status={o.status} />}
          ]}
          empty={<EmptyState icon={ReceiptText} title="No orders yet." />}
        />
      )}
    </Card>
  )
}

function Loading() {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">Loading statistics…</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({length: 4}, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  )
}

export function Dashboard() {
  const [range, setRange] = useState<Range>('7d')
  const stats = useGetOrderStatsQuery({range})
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Tabs
          value={range}
          onValueChange={v => {
            setRange(v as Range)
          }}>
          <TabsList aria-label="Range">
            <TabsTrigger value="7d">7 days</TabsTrigger>
            <TabsTrigger value="30d">30 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {stats.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-card p-5">
          <p>Could not load statistics. Try again.</p>
          <Button variant="outline" onClick={() => void stats.refetch()}>
            Retry
          </Button>
        </div>
      ) : !stats.data ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <RevenueKpi stats={stats.data} currency="EUR" />
            <RevenueKpi stats={stats.data} currency="PLN" />
            <KpiCard
              label="Paid orders"
              value={String(stats.data.paidCount)}
              delta={delta(stats.data.paidCount, stats.data.previousPaidCount)}
              hint="vs previous period"
              spark={paidPerDay(stats.data)}
            />
            <KpiCard
              label="Conversion"
              value={formatPercent(stats.data.conversion)}
              hint={`${String(stats.data.expiredCount)} expired`}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <RevenueChart stats={stats.data} />
            <StatusCard stats={stats.data} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TopProducts stats={stats.data} />
            <LatestOrders />
          </div>
        </>
      )}
    </div>
  )
}
