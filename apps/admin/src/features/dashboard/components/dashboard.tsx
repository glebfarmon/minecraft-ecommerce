'use client'

import {Card} from '@/components/card'
import {DataTable} from '@/components/data-table'
import {DayChart} from '@/components/day-chart'
import {EmptyState} from '@/components/empty-state'
import {KpiCard} from '@/components/kpi-card'
import {Skeleton} from '@/components/skeleton'
import {StatusDonut} from '@/components/status-donut'
import {StatusDot} from '@/components/status-dot'
import {useFormat} from '@/hooks/use-format'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {useReportCurrency} from '@/hooks/use-report-currency'
import {
  type GetOrderStatsApiResponse,
  useGetOrderStatsQuery,
  useListAdminOrdersQuery
} from '@/lib/api/generated'
import {delta} from '@/lib/format'
import {PackageOpen, ReceiptText} from 'lucide-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useState, useSyncExternalStore} from 'react'

import {CURRENCIES, type Currency} from '@shop/shared/catalog'
import {Button} from '@shop/ui/button'
import {cn} from '@shop/ui/lib/utils'
import {Tabs, TabsList, TabsTrigger} from '@shop/ui/tabs'

import {CurrencyDonut} from './currency-donut'

type Range = '7d' | '30d'
type Stats = GetOrderStatsApiResponse

const LINK =
  'text-[13px] text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full'

/** Revenue leads on the left over two rows; the other four sit 2 × 2 beside it, each wide enough for a full amount. */
const KPI_GRID =
  'grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]'
const HERO_CELL = 'sm:col-span-2 xl:col-span-1 xl:row-span-2'

function Kpis({stats}: {stats: Stats}) {
  const t = useTranslations('dashboard')
  const f = useFormat()
  const {currency} = stats
  const money = (minor: number | null) => (minor === null ? '—' : f.money(minor, currency))
  // While orders wait for a rate the revenue is partial: no change figure, and a dash when
  // nothing is converted yet, never €0.00.
  const waiting = stats.awaitingRate > 0
  const partialChange = waiting || stats.previousAwaitingRate > 0
  const noneConverted = waiting && stats.awaitingRate >= stats.paidCount
  const change = partialChange ? null : delta(stats.revenueMinor, stats.previousRevenueMinor)
  const paidChange = delta(stats.paidCount, stats.previousPaidCount)
  return (
    <div className={KPI_GRID}>
      <KpiCard
        hero
        className={HERO_CELL}
        label={t('revenue')}
        value={noneConverted ? '—' : f.money(stats.revenueMinor, currency)}
        count={
          noneConverted ? undefined : {to: stats.revenueMinor, format: n => f.money(n, currency)}
        }
        delta={change}
        hint={
          partialChange
            ? t('partialRevenue')
            : change === null
              ? t('noSalesPrevious')
              : t('vsPrevious')
        }
        tone="accent"
        spark={noneConverted ? undefined : stats.daily.map(d => d.totalMinor)}
      />
      <KpiCard
        label={t('paidOrders')}
        value={String(stats.paidCount)}
        count={{to: stats.paidCount, format: String}}
        delta={paidChange}
        hint={paidChange === null ? t('noPaidPrevious') : t('vsPrevious')}
        spark={stats.daily.map(d => d.paidCount)}
      />
      <KpiCard label={t('averageOrder')} value={money(stats.averageMinor)} />
      <KpiCard
        label={t('conversion')}
        value={f.percent(stats.conversion)}
        hint={t('expired', {count: stats.expiredCount})}
      />
      <KpiCard
        label={t('ltv')}
        value={money(stats.ltvMinor)}
        hint={t('buyers', {count: stats.buyers})}
      />
    </div>
  )
}

function RevenueChart({stats}: {stats: Stats}) {
  const t = useTranslations('dashboard')
  const f = useFormat()
  return (
    <Card title={t('revenuePerDay')}>
      <DayChart
        days={stats.daily.map(d => ({day: d.day, value: d.totalMinor}))}
        label={t('revenuePerDay')}
        format={n => f.money(n, stats.currency)}
      />
    </Card>
  )
}

function CurrencyCard({stats}: {stats: Stats}) {
  const t = useTranslations('dashboard')
  return (
    <Card title={t('paidByCurrency')}>
      {stats.byCurrency.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t('noPaidRange')} />
      ) : (
        <CurrencyDonut byCurrency={stats.byCurrency} />
      )}
    </Card>
  )
}

function StatusCard({stats}: {stats: Stats}) {
  const t = useTranslations('dashboard')
  const statuses = stats.byStatus.filter(s => s.count > 0)
  return (
    <Card title={t('ordersByStatus')}>
      {statuses.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t('noOrdersRange')} />
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
  const t = useTranslations('dashboard')
  return (
    <Card title={t('topProducts')}>
      {stats.topProducts.length === 0 ? (
        <EmptyState icon={PackageOpen} title={t('noSalesRange')} />
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
  const t = useTranslations('dashboard')
  const f = useFormat()
  const page = useListAdminOrdersQuery({})
  const held = useHoldLoading(page.isLoading)
  return (
    <Card
      title={t('latestOrders')}
      action={
        <Link href="/orders" className={LINK}>
          {t('viewAll')}
        </Link>
      }>
      {!held && (page.isError || !page.data) ? (
        <p className="text-muted">{t('ordersFailed')}</p>
      ) : (
        <DataTable
          caption={t('latestOrders')}
          loading={held ? 5 : undefined}
          rows={page.data?.orders.slice(0, 5) ?? []}
          rowKey={o => o.id}
          rowHref={o => `/orders/${o.id}`}
          columns={[
            {
              header: t('colOrder'),
              primary: true,
              cell: o => <span className="font-mono">{o.publicId}</span>
            },
            {header: t('colNick'), cell: o => o.nick},
            {header: t('colTotal'), cell: o => f.money(o.totalMinor, o.currency)},
            {
              header: t('colStatus'),
              cell: o => <StatusDot status={o.status} />,
              placeholder: 'h-6 w-20 rounded-full'
            }
          ]}
          empty={<EmptyState icon={ReceiptText} title={t('noOrdersYet')} />}
        />
      )}
    </Card>
  )
}

/** A donut ring of the charts' size (`Donut` is a 96px ring). */
function DonutSkeleton() {
  return (
    <div aria-hidden className="skeleton grid size-24 shrink-0 place-items-center rounded-full">
      <div className="size-[62px] rounded-full bg-card" />
    </div>
  )
}

/** The dashboard as it will be: the same grids, cards and titles, the figures as placeholders. */
function Loading() {
  const t = useTranslations('dashboard')
  const legend = (n: number) => (
    <ul aria-hidden className="flex flex-col gap-2">
      {Array.from({length: n}, (_, i) => (
        <li key={i} className="flex items-center gap-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-8 rounded-full" />
        </li>
      ))}
    </ul>
  )
  return (
    <div className="grid gap-4">
      <span role="status" className="sr-only">
        {t('loadingStats')}
      </span>
      <div className={KPI_GRID}>
        <KpiCard
          hero
          loading
          tone="accent"
          className={HERO_CELL}
          label={t('revenue')}
          value=""
          hint=" "
          spark={[]}
        />
        <KpiCard loading label={t('paidOrders')} value="" hint=" " spark={[]} />
        <KpiCard loading label={t('averageOrder')} value="" />
        <KpiCard loading label={t('conversion')} value="" hint=" " />
        <KpiCard loading label={t('ltv')} value="" hint=" " />
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card title={t('revenuePerDay')}>
          <div aria-hidden className="flex flex-col gap-2">
            <Skeleton className="h-40" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-10 rounded-full" />
              <Skeleton className="h-3 w-10 rounded-full" />
            </div>
          </div>
        </Card>
        <Card title={t('ordersByStatus')}>
          <div className="flex flex-wrap items-center gap-6">
            <DonutSkeleton />
            {legend(3)}
          </div>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t('paidByCurrency')}>
          <div className="flex flex-wrap items-center gap-6">
            <DonutSkeleton />
            {legend(2)}
          </div>
        </Card>
        <Card title={t('topProducts')}>
          <ol aria-hidden className="flex flex-col gap-1.5">
            {Array.from({length: 3}, (_, i) => (
              <li
                key={i}
                className="skeleton flex h-[44px] items-center gap-3 rounded-plate px-4"
              />
            ))}
          </ol>
        </Card>
      </div>
      <LatestOrders />
    </div>
  )
}

/** `skeleton`: the route's loading state, this layout with placeholders. */
export function Dashboard({skeleton = false}: {skeleton?: boolean}) {
  const t = useTranslations('dashboard')
  const common = useTranslations('common')
  const [range, setRange] = useState<Range>('7d')
  const [currency, setCurrency] = useReportCurrency()
  // The remembered currency is only known after hydration; fetching before it would ask for EUR first.
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  )
  const query = useGetOrderStatsQuery({range, currency}, {skip: !hydrated})
  // A range switch keeps the previous range on screen (dimmed, busy) until the new numbers
  // arrive; a currency switch must not, so old-currency numbers never sit under the new label.
  const stats = query.currentData ?? (query.data?.currency === currency ? query.data : undefined)
  const busy = query.isFetching && stats !== query.currentData
  const held = useHoldLoading(!stats && !query.isError) || skeleton
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-3">
        <Tabs
          value={currency}
          onValueChange={v => {
            setCurrency(v as Currency)
          }}>
          <TabsList aria-label={t('currency')}>
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
          <TabsList aria-label={t('range')}>
            <TabsTrigger value="7d">{t('days7')}</TabsTrigger>
            <TabsTrigger value="30d">{t('days30')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {query.isError && !skeleton ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-card p-5">
          <p>{t('statsFailed')}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {common('retry')}
          </Button>
        </div>
      ) : !stats || held ? (
        <Loading />
      ) : (
        <div
          aria-busy={busy}
          className={cn(
            'grid gap-4 transition-opacity duration-200 ease-out',
            busy && 'opacity-60'
          )}>
          <Kpis stats={stats} />
          {stats.awaitingRate > 0 && (
            <p className="text-[12px] text-muted">
              {t('awaitingRate', {count: stats.awaitingRate})}
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
        </div>
      )}
    </div>
  )
}
