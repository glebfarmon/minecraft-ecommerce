'use client'

import {notify} from '@/components/toaster'
import {useMarkDeliveryDoneMutation, useRetryDeliveryMutation} from '@/lib/api/generated'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {Button} from '@shop/ui/button'

type Status = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'NEEDS_REVIEW' | 'CANCELLED'

/**
 * Retry and Mark as done for a stuck delivery, with the inline confirmation: a `NEEDS_REVIEW`
 * delivery may already have run its last command, so retrying it asks first. Shared by the
 * order's deliveries card and the deliveries list. Strings live in `orders.deliveries`.
 */
export function DeliveryActions({
  id,
  status,
  canResolve,
  onError,
  onStart
}: {
  id: string
  status: Status
  canResolve: boolean
  /** The owner of the error banner shows a failed action. */
  onError: (error: unknown) => void
  /** Called before an action runs, to clear the owner's previous error. */
  onStart: () => void
}) {
  const t = useTranslations('orders.deliveries')
  const [retry] = useRetryDeliveryMutation()
  const [markDone] = useMarkDeliveryDoneMutation()
  const [confirm, setConfirm] = useState<'retry' | 'done' | null>(null)

  async function run(action: Promise<{error?: unknown}>, done: string) {
    onStart()
    setConfirm(null)
    const result = await action
    if (result.error) onError(result.error)
    else notify.ok(done)
  }
  const doRetry = () => run(retry({id}), t('retried'))

  const stuck = status === 'FAILED' || status === 'NEEDS_REVIEW'
  if (!stuck || !canResolve) return null
  if (confirm)
    return (
      <div role="group" className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px]">
          {confirm === 'retry' ? t('confirmRetry') : t('confirmDone')}
        </p>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm === 'retry') void doRetry()
            else void run(markDone({id}), t('markedDone'))
          }}>
          {confirm === 'retry' ? t('confirmRetryButton') : t('confirmDoneButton')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setConfirm(null)
          }}>
          {t('cancel')}
        </Button>
      </div>
    )
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => {
          if (status === 'NEEDS_REVIEW') setConfirm('retry')
          else void doRetry()
        }}>
        {t('retry')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          setConfirm('done')
        }}>
        {t('markDone')}
      </Button>
    </div>
  )
}
