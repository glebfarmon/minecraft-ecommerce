'use client'

import {Card} from '@/components/card'
import {BackupCodes} from '@/features/auth/components/backup-codes'
import {authClient} from '@/lib/auth-client'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

import {Button} from '@shop/ui/button'

export function AccountActions() {
  const router = useRouter()
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function regenerate() {
    setError(null)
    const {data, error: failed} = await authClient.twoFactor.generateBackupCodes({})
    if (failed) {
      setError('Could not generate backup codes. Try again.')
      return
    }
    setCodes(data.backupCodes)
  }

  async function signOutEverywhere() {
    setError(null)
    const {error: failed} = await authClient.revokeSessions()
    if (failed) {
      setError('Could not sign out. Try again.')
      return
    }
    router.replace('/login')
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card title="Backup codes">
        <p className="text-[13px] text-muted">
          One-time codes for when your authenticator app is not at hand.
        </p>
        <Button type="button" variant="outline" className="w-fit" onClick={() => void regenerate()}>
          Regenerate backup codes
        </Button>
        {codes && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px]">New codes replace the old ones. Save them now.</p>
            <BackupCodes codes={codes} />
          </div>
        )}
      </Card>
      <Card title="Sessions">
        <p className="text-[13px] text-muted">Signs you out on every device, this one included.</p>
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => void signOutEverywhere()}>
          Sign out everywhere
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
