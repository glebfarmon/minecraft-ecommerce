'use client'

import {Card} from '@/components/card'
import {type Tone, ToneDot} from '@/components/status-dot'
import {DeliveryActions} from '@/features/deliveries/components/delivery-actions'
import {useFormat} from '@/hooks/use-format'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {type GetAdminOrderApiResponse} from '@/lib/api/generated'
import {useTranslations} from 'next-intl'

type Delivery = GetAdminOrderApiResponse['deliveries'][number]
type Status = Delivery['status']

const TONE: Record<Status, Tone> = {
  PENDING: 'idle',
  RUNNING: 'idle',
  DONE: 'ok',
  FAILED: 'bad',
  NEEDS_REVIEW: 'bad',
  CANCELLED: 'idle'
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
  const [error, setError] = useMessage()
  const report = useReportError(setError)

  if (deliveries.length === 0) return null
  return (
    <Card title={t('title')}>
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
          {error}
        </p>
      )}
      {deliveries.map(d => {
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
            <DeliveryActions
              id={d.id}
              status={d.status}
              canResolve={canResolve}
              onStart={() => {
                setError(null)
              }}
              onError={report}
            />
          </section>
        )
      })}
    </Card>
  )
}
