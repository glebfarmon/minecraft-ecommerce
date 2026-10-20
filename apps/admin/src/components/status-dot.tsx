import {useTranslations} from 'next-intl'

import type {OrderStatus} from '@shop/shared/orders'
import {cn} from '@shop/ui/lib/utils'

export type Tone = 'ok' | 'warn' | 'bad' | 'idle'
export const STATUS_TONE: Record<OrderStatus, Tone> = {
  PAID: 'ok',
  DELIVERED: 'ok',
  PENDING: 'warn',
  EXPIRED: 'idle',
  REFUNDED: 'bad',
  DISPUTED: 'bad'
}
const PILL: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  idle: 'bg-idle-soft text-muted'
}
const DOT: Record<Tone, string> = {ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', idle: 'bg-idle'}

export function ToneDot({tone, label}: {tone: Tone; label: string}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium',
        PILL[tone]
      )}>
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT[tone])} />
      {label}
    </span>
  )
}

export function StatusDot({status}: {status: OrderStatus}) {
  const t = useTranslations('status')
  return <ToneDot tone={STATUS_TONE[status]} label={t(status)} />
}
