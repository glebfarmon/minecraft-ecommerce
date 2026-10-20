'use client'

import {Card} from '@/components/card'
import {BackupCodes} from '@/features/auth/components/backup-codes'
import {authClient} from '@/lib/auth-client'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

import {Button} from '@shop/ui/button'

export function AccountActions() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function regenerate() {
    setError(null)
    const {data, error: failed} = await authClient.twoFactor.generateBackupCodes({})
    if (failed) {
      setError(t('backupCodesFailed'))
      return
    }
    setCodes(data.backupCodes)
  }

  async function signOutEverywhere() {
    setError(null)
    const {error: failed} = await authClient.revokeSessions()
    if (failed) {
      setError(t('signOutFailed'))
      return
    }
    router.replace('/login')
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card title={t('backupCodes')}>
        <p className="text-[13px] text-muted">{t('oneTimeCodesForWhenYour')}</p>
        <Button type="button" variant="outline" className="w-fit" onClick={() => void regenerate()}>
          {t('regenerateBackupCodes')}
        </Button>
        {codes && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px]">{t('newCodesReplaceTheOldOnes')}</p>
            <BackupCodes codes={codes} />
          </div>
        )}
      </Card>
      <Card title={t('sessions')}>
        <p className="text-[13px] text-muted">{t('signsYouOutOnEveryDevice')}</p>
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => void signOutEverywhere()}>
          {t('signOutEverywhere')}
        </Button>
      </Card>
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad lg:col-span-2">
          {error}
        </p>
      )}
    </div>
  )
}
