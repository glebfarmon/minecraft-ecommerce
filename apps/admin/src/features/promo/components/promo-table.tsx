'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {notify} from '@/components/toaster'
import {useFormat} from '@/hooks/use-format'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {
  type ListPromoCodesApiResponse,
  useDeletePromoCodeMutation,
  useListPromoCodesQuery,
  useSetPromoCodeActiveMutation
} from '@/lib/api/generated'
import {TicketPercent} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

import {Button} from '@shop/ui/button'

import {PromoStatusDot} from './promo-status'

type Promo = ListPromoCodesApiResponse[number]

/** Whole days in UTC, like every other admin time. */
function useDay() {
  const f = useFormat()
  const format = new Intl.DateTimeFormat(f.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })
  return (iso: string) => format.format(new Date(iso))
}

export function PromoTable({skeleton = false}: {skeleton?: boolean}) {
  const t = useTranslations('promo')
  const f = useFormat()
  const day = useDay()
  const router = useRouter()
  const codes = useListPromoCodesQuery()
  const [setActive] = useSetPromoCodeActiveMutation()
  const [remove] = useDeletePromoCodeMutation()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useMessage()
  const report = useReportError(setError)

  const held = useHoldLoading(codes.isLoading) || skeleton
  if (!held && codes.isError)
    return (
      <p role="alert" className="rounded-card bg-card p-5">
        {t('loadFailed')}
      </p>
    )

  async function run(action: Promise<{error?: unknown}>, done: string) {
    setError(null)
    const result = await action
    if (result.error) report(result.error)
    else notify.ok(done)
  }

  const discount = (p: Promo) =>
    p.kind === 'PERCENT' ? `${String(p.value)}%` : f.money(p.value, p.currency ?? 'EUR')
  const period = (p: Promo) => {
    if (p.startsAt && p.endsAt) return t('range', {from: day(p.startsAt), to: day(p.endsAt)})
    if (p.startsAt) return t('from', {date: day(p.startsAt)})
    if (p.endsAt) return t('until', {date: day(p.endsAt)})
    return t('always')
  }

  const list = codes.data ?? []
  const confirmingCode = list.find(p => p.id === confirming)

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
          {error}
        </p>
      )}
      {confirmingCode && (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-card p-4">
          <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {t('deleteCode', {code: confirmingCode.code})}
          </p>
          <Button
            variant="danger"
            onClick={() => {
              setConfirming(null)
              void run(
                remove({id: confirmingCode.id, version: String(confirmingCode.version)}),
                t('deleted')
              )
            }}>
            {t('confirmDelete')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirming(null)
            }}>
            {t('cancel')}
          </Button>
        </div>
      )}
      <DataTable
        caption={t('title')}
        loading={held ? 6 : undefined}
        rows={list}
        rowKey={p => p.id}
        rowLabel={p => p.code}
        rowHref={p => `/promo-codes/${p.id}`}
        columns={[
          {
            header: t('colCode'),
            primary: true,
            cell: p => <span className="font-mono">{p.code}</span>
          },
          {header: t('colDiscount'), cell: discount, className: 'tabular'},
          {
            header: t('colUses'),
            cell: p => `${String(p.usedCount)} / ${p.maxUses === null ? '∞' : String(p.maxUses)}`,
            className: 'tabular'
          },
          {header: t('colPeriod'), cell: period, className: 'tabular text-muted'},
          {
            header: t('colStatus'),
            cell: p => <PromoStatusDot status={p.status} />,
            placeholder: 'h-6 w-20 rounded-full'
          }
        ]}
        menu={p => [
          {
            label: t('edit'),
            onSelect: () => {
              router.push(`/promo-codes/${p.id}`)
            }
          },
          {
            label: p.isActive ? t('disable') : t('enable'),
            onSelect: () => {
              void run(
                setActive({id: p.id, body: {isActive: !p.isActive, version: p.version}}),
                p.isActive ? t('disabledToast') : t('enabledToast')
              )
            }
          },
          {
            label: t('delete'),
            tone: 'danger',
            onSelect: () => {
              setConfirming(p.id)
            }
          }
        ]}
        empty={<EmptyState icon={TicketPercent} title={t('empty')} />}
      />
    </div>
  )
}
