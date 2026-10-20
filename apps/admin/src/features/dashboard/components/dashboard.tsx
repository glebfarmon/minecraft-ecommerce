'use client'

import {Card} from '@/components/card'
import {DataTable} from '@/components/data-table'
import {DayChart} from '@/components/day-chart'
import {EmptyState} from '@/components/empty-state'
import {KpiCard} from '@/components/kpi-card'
import {Skeleton, SkeletonRows} from '@/components/skeleton'
import {StatusDonut} from '@/components/status-donut'
import {StatusDot} from '@/components/status-dot'
import {useReportCurrency} from '@/hooks/use-report-currency'
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

import {CurrencyDonut} from './currency-donut'

type Range = '7d' | '30d'
type Stats = GetOrderStatsApiResponse

const LINK =
  'text-[13px] text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full'

const money = (minor: number | null, currency: Currency) =>
  minor === null ? '—' : formatMoney(minor, currency)

function Kpis({stats}: {stats: Stats}) {
  const {currency} = stats
  // While orders wait for a rate the revenue is partial: no change figure, and a dash when
  // nothing is converted yet, never €0.00.
  const waiting = stats.awaitingRate > 0
  const noneConverted = waiting && stats.awaitingRate >= stats.paidCount
  const change = waiting ? null : delta(stats.revenueMinor, stats.previousRevenueMinor)
  const paidChange = delta(stats.paidCount, stats.previousPaidCount)
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        label="Revenue"
        value={noneConverted ? '—' : formatMoney(stats.revenueMinor, currency)}
        count={
          noneConverted
            ? undefined
            : {to: stats.revenueMinor, format: n => formatMoney(n, currency)}
        }
        delta={change}
        hint={
          waiting
            ? 'Partial: some orders wait for a rate'
            : change === null
              ? 'No sales in the previous period'
              : 'vs previous period'
        }
        tone="accent"
        spark={noneConverted ? undefined : stats.daily.map(d => d.totalMinor)}
      />
      <KpiCard
        label="Paid orders"
        value={String(stats.paidCount)}
        count={{to: stats.paidCount, format: String}}
        delta={paidChange}
        hint={paidChange === null ? 'No paid orders in the previous period' : 'vs previous period'}
        spark={stats.daily.map(d => d.paidCount)}
      />
      <KpiCard label="Average order" value={money(stats.averageMinor, currency)} />
      <KpiCard
        label="Conversion"
        value={formatPercent(stats.conversion)}
        hint={`${String(stats.expiredCount)} expired`}
      />
      <KpiCard
        label="LTV"
        value={money(stats.ltvMinor, currency)}
        hint={`${String(stats.buyers)} ${stats.buyers === 1 ? 'buyer' : 'buyers'}`}
      />
    </div>
  )
}

function RevenueChart({stats}: {stats: Stats}) {
  return (
    <Card title="Revenue per day">
      <DayChart
        days={stats.daily.map(d => ({day: d.day, value: d.totalMinor}))}
        label="Revenue per day"
        format={n => formatMoney(n, stats.currency)}
      />
    </Card>
  )
}

function CurrencyCard({stats}: {stats: Stats}) {
  return (
    <Card title="Paid orders by currency">
      {stats.byCurrency.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No paid orders in this range." />
      ) : (
        <CurrencyDonut byCurrency={stats.byCurrency} />
      )}
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
          <StatusDonut counts={statuses} />
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({length: 5}, (_, i) => (
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
  const [currency, setCurrency] = useReportCurrency()
  const query = useGetOrderStatsQuery({range, currency})
  // `currentData`, not `data`: after a switch the previous currency's numbers must not be shown
  // under the new label while the new ones load.
  const stats = query.currentData
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-3">
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
      {query.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-card p-5">
          <p>Could not load statistics. Try again.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : !stats ? (
        <Loading />
      ) : (
        <>
          <Kpis stats={stats} />
          {stats.awaitingRate > 0 && (
            <p className="text-[12px] text-muted">
              {`${String(stats.awaitingRate)} ${stats.awaitingRate === 1 ? 'order' : 'orders'} waiting for an exchange rate — not in the totals yet.`}
            </p>
          )}
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <RevenueChart stats={stats} />
            <StatusCard stats={stats} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <CurrencyCard stats={stats} />
            <TopProducts stats={stats} />
          </div>
          <LatestOrders />
        </>
      )}
    </div>
  )
}
