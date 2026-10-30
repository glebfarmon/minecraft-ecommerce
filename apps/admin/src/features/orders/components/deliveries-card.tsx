'use client'

import {Card} from '@/components/card'
import {type Tone, ToneDot} from '@/components/status-dot'
import {notify} from '@/components/toaster'
import {useFormat} from '@/hooks/use-format'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {
  type GetAdminOrderApiResponse,
  useMarkDeliveryDoneMutation,
  useRetryDeliveryMutation
} from '@/lib/api/generated'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {Button} from '@shop/ui/button'

type Delivery = GetAdminOrderApiResponse['deliveries'][number]
type Status = Delivery['status']

const TONE: Record<Status, Tone> = {
  PENDING: 'idle',
  RUNNING: 'idle',
  DONE: 'ok',
  FAILED: 'bad',
  NEEDS_REVIEW: 'bad'
}

export function DeliveriesCard({
  deliveries,
  canResolve
}: {
  deliveries: Delivery[]
  canResolve: boolean
}) {
  const t = useTranslations('orders.deliveries')
  const f = useFormat()
  const [retry] = useRetryDeliveryMutation()
  const [markDone] = useMarkDeliveryDoneMutation()
  const [confirming, setConfirming] = useState<{id: string; action: 'retry' | 'done'} | null>(null)
  const [error, setError] = useMessage()
  const report = useReportError(setError)

  async function run(action: Promise<{error?: unknown}>, done: string) {
    setError(null)
    setConfirming(null)
    const result = await action
    if (result.error) report(result.error)
    else notify.ok(done)
  }
  const doRetry = (id: string) => run(retry({id}), t('retried'))

  if (deliveries.length === 0) return null
  return (
    <Card title={t('title')}>
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
          {error}
        </p>
      )}
      {deliveries.map(d => {
        const stuck = d.status === 'FAILED' || d.status === 'NEEDS_REVIEW'
        const confirm = confirming?.id === d.id ? confirming.action : null
        return (
          <section key={d.id} className="flex flex-col gap-2 rounded-plate bg-card-raised p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="font-medium">{t(`kind.${d.kind}`)}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {d.serverName}
                {d.productName && ` · ${d.productName}`}
              </span>
              <ToneDot tone={TONE[d.status]} label={t(`status.${d.status}`)} />
              <span className="tabular text-muted">{t('attempts', {count: d.attempts})}</span>
              {d.status === 'PENDING' && (
                <span className="tabular text-muted">
                  {t('nextAttempt', {time: f.time(d.nextAttemptAt)})}
                </span>
              )}
            </div>
            {d.lastError && (
              <p
                aria-label={t('lastError')}
                className="font-mono text-[12px] [overflow-wrap:anywhere] text-bad">
                {d.lastError}
              </p>
            )}
            <ul aria-label={t('commands')} className="flex flex-col gap-1">
              {d.commands.map((c, i) => (
                <li
                  key={`${String(i)}-${c}`}
                  className="flex flex-wrap items-center gap-x-2 font-mono text-[12px]">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{c}</span>
                  <span className="font-sans text-muted">
                    {i < d.commandsDone ? t('sent') : t('notSent')}
                  </span>
                </li>
              ))}
            </ul>
            {d.replies.length > 0 && (
              <ul aria-label={t('replies')} className="flex flex-col gap-1">
                {d.replies.map((r, i) => (
                  <li
                    key={`${String(i)}-${r}`}
                    className="font-mono text-[12px] [overflow-wrap:anywhere] text-muted">
                    {r}
                  </li>
                ))}
              </ul>
            )}
            {stuck && canResolve && !confirm && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (d.status === 'NEEDS_REVIEW') setConfirming({id: d.id, action: 'retry'})
                    else void doRetry(d.id)
                  }}>
                  {t('retry')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirming({id: d.id, action: 'done'})
                  }}>
                  {t('markDone')}
                </Button>
              </div>
            )}
            {confirm && (
              <div role="group" className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-[13px]">
                  {confirm === 'retry' ? t('confirmRetry') : t('confirmDone')}
                </p>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm === 'retry') void doRetry(d.id)
                    else void run(markDone({id: d.id}), t('markedDone'))
                  }}>
                  {confirm === 'retry' ? t('confirmRetryButton') : t('confirmDoneButton')}
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
          </section>
        )
      })}
    </Card>
  )
}
