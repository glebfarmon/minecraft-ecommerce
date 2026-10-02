'use client'

import {CountUp} from '@/components/count-up'
import {OnlineDot} from '@/components/online-dot'
import {useOnlinePlayers} from '@/features/status/status-provider'
import {useTranslations} from 'next-intl'

/** Green dot and "N online"; a grey dot and 0 while the count is unknown. */
export function OnlineBadge() {
  const t = useTranslations('nav')
  const players = useOnlinePlayers()
  return (
    <>
      <OnlineDot online={players !== null} />
      {t.rich('online', {count: () => <CountUp value={players ?? 0} />})}
    </>
  )
}
