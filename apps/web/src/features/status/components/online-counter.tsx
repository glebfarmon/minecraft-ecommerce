'use client'

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
        {players ?? 0}
      </span>
      <span className="flex flex-col gap-1.5">
        <OnlineDot online={players !== null} />
        <span className="text-[13px] font-medium tracking-[0.02em] text-muted uppercase">
          {t('playersOnline')}
        </span>
      </span>
    </div>
  )
}
