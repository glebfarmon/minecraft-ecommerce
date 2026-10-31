'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {type Tone, ToneDot} from '@/components/status-dot'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {useListAdminDeliveriesQuery} from '@/lib/api/generated'
import {PackageCheck} from 'lucide-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useState} from 'react'

import {Button} from '@shop/ui/button'

import {DeliveryActions} from './delivery-actions'

const TONE: Record<string, Tone> = {FAILED: 'bad', NEEDS_REVIEW: 'bad'}

function PageRows({
  cursor,
  isFirst,
  isLast,
  onMore,
  skeleton,
  canResolve,
  onStart,
  onError
}: {
  cursor: string | undefined
  isFirst: boolean
  isLast: boolean
  onMore: (cursor: string) => void
  skeleton: boolean
  canResolve: boolean
  onStart: () => void
  onError: (error: unknown) => void
}) {
  const t = useTranslations('deliveries')
  const td = useTranslations('orders.deliveries')
  const page = useListAdminDeliveriesQuery({cursor})
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
        caption={t('title')}
        loading={held ? 6 : undefined}
        rows={page.data?.deliveries ?? []}
        rowKey={d => d.id}
        columns={[
          {header: t('colKind'), primary: true, cell: d => td(`kind.${d.kind}`)},
          {header: t('colNick'), cell: d => d.nick},
          {header: t('colServer'), cell: d => d.serverName},
          {header: t('colProduct'), cell: d => d.productName ?? t('none')},
          {
            header: t('colStatus'),
            cell: d => <ToneDot tone={TONE[d.status] ?? 'idle'} label={td(`status.${d.status}`)} />,
            placeholder: 'h-6 w-24 rounded-full'
          },
          {header: t('colAttempts'), cell: d => d.attempts, className: 'tabular'},
          {
            header: t('colError'),
            cell: d =>
              d.lastError ? (
                <span title={d.lastError} className="font-mono text-[12px] text-bad">
                  {d.lastError}
                </span>
              ) : (
                t('none')
              )
          },
          {
            header: t('colOrder'),
            cell: d =>
              d.orderId && d.orderPublicId ? (
                <Link
                  href={`/orders/${d.orderId}`}
                  className="rounded-sm font-mono hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                  {d.orderPublicId}
                </Link>
              ) : (
                t('noOrder')
              )
          },
          ...(canResolve
            ? [
                {
                  header: t('colActions'),
                  cell: (d: {
                    id: string
                    status: Parameters<typeof DeliveryActions>[0]['status']
                  }) => (
                    <div className="whitespace-normal">
                      <DeliveryActions
                        id={d.id}
                        status={d.status}
                        canResolve
                        onStart={onStart}
                        onError={onError}
                      />
                    </div>
                  )
                }
              ]
            : [])
        ]}
        empty={isFirst ? <EmptyState icon={PackageCheck} title={t('empty')} /> : null}
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

export function DeliveriesTable({
  canResolve,
  skeleton = false
}: {
  canResolve: boolean
  /** The route's loading state: this layout with placeholders. */
  skeleton?: boolean
}) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [error, setError] = useMessage()
  const report = useReportError(setError)
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
          {error}
        </p>
      )}
      {cursors.map((cursor, i) => (
        <PageRows
          key={cursor ?? 'first'}
          cursor={cursor}
          isFirst={i === 0}
          isLast={i === cursors.length - 1}
          skeleton={skeleton}
          canResolve={canResolve}
          onStart={() => {
            setError(null)
          }}
          onError={report}
          onMore={next => {
            setCursors(c => [...c, next])
          }}
        />
      ))}
    </div>
  )
}
