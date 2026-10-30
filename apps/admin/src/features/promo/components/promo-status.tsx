import {type Tone, ToneDot} from '@/components/status-dot'
import {useTranslations} from 'next-intl'

import type {PromoStatus} from '@shop/shared/promo'

const TONE: Record<PromoStatus, Tone> = {
  active: 'ok',
  scheduled: 'warn',
  expired: 'idle',
  used_up: 'idle',
  disabled: 'idle'
}

export function PromoStatusDot({status}: {status: PromoStatus}) {
  const t = useTranslations('promo.status')
  return <ToneDot tone={TONE[status]} label={t(status)} />
}
