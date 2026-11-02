'use client'

import {Card} from '@/components/card'
import {notify} from '@/components/toaster'
import {REFUND_RETRY_AFTER_MS} from '@/config/orders'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {type GetAdminOrderApiResponse, useRefundAdminOrderMutation} from '@/lib/api/generated'
import {useTranslations} from 'next-intl'
import {useEffect, useId, useState} from 'react'

import {Button} from '@shop/ui/button'

type Order = Pick<
  GetAdminOrderApiResponse,
  'id' | 'status' | 'refundRequestedAt' | 'stripePaymentIntentId'
>

/** `now` is injectable so the 15-minute rule can be tested without waiting. */
export function RefundBar({
  order,
  canRefund,
  now
}: {
  order: Order
  canRefund: boolean
  now?: number
}) {
  const t = useTranslations('orders.refund')
  const checkboxId = useId()
  const [refund, {isLoading}] = useRefundAdminOrderMutation()
  const [open, setOpen] = useState(false)
  const [revoke, setRevoke] = useState(true)
  const [error, setError] = useMessage()
  const report = useReportError(setError)
  const [clock, setClock] = useState(() => now ?? Date.now())

  const requestedAt = order.refundRequestedAt ? Date.parse(order.refundRequestedAt) : null
  const remaining = requestedAt === null ? 0 : requestedAt + REFUND_RETRY_AFTER_MS - clock
  const live = remaining > 0

  // Show the button again once the reservation runs out, without a reload.
  useEffect(() => {
    if (now !== undefined || !live) return
    const timer = setTimeout(() => {
      setClock(Date.now())
    }, remaining)
    return () => {
      clearTimeout(timer)
    }
  }, [now, live, remaining])

  const eligible = order.status === 'PAID' || order.status === 'DELIVERED'
  if (order.status === 'REFUNDED' || order.status === 'DISPUTED') {
    return (
      <Card title={t('title')}>
        <p className="text-[13px]">{t(order.status === 'REFUNDED' ? 'refunded' : 'disputed')}</p>
      </Card>
    )
  }
  // No payment intent recorded: the api could not refund it, so there is no button.
  if (!eligible || !canRefund || !order.stripePaymentIntentId) return null

  async function confirm() {
    setError(null)
    const result = await refund({id: order.id, body: {revoke}})
    if (result.error) {
      report(result.error)
      return
    }
    setOpen(false)
    notify.ok(t('requested'))
  }

  return (
    <Card title={t('title')}>
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
          {error}
        </p>
      )}
      {live ? (
        <p role="status" className="text-[13px]">
          {t('waiting')}
        </p>
      ) : open ? (
        <div role="group" aria-label={t('title')} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[13px]">
            <input
              id={checkboxId}
              type="checkbox"
              checked={revoke}
              onChange={e => {
                setRevoke(e.target.checked)
              }}
              className="size-4 accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
            <label htmlFor={checkboxId}>{t('revoke')}</label>
          </div>
          <p className="text-[13px] text-muted">{t('note')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" disabled={isLoading} onClick={() => void confirm()}>
              {t('confirm')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false)
              }}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRevoke(true)
              setOpen(true)
            }}>
            {t('button')}
          </Button>
        </div>
      )}
    </Card>
  )
}
