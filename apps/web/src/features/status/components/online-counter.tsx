'use client'

import {CountUp} from '@/components/count-up'
import {OnlineDot} from '@/components/online-dot'
import {useOnlinePlayers} from '@/features/status/status-provider'
import {useTranslations} from 'next-intl'

/** The big player count in the hero. */
export function OnlineCounter() {
  const t = useTranslations('hero')
  const players = useOnlinePlayers()
  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-label={players !== null ? t('onlineLabel', {count: players}) : t('offlineLabel')}>
      <span className="tabular text-[clamp(3rem,5vw,4.25rem)] leading-none font-bold tracking-[-0.04em]">
        <CountUp value={players ?? 0} />
      </span>
      <span className="flex flex-col gap-1.5">
        <OnlineDot online={players !== null} />
        <span className="eyebrow">{t('playersOnline')}</span>
      </span>
    </div>
  )
}
