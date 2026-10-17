'use client'

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
    <div className="flex max-w-sm flex-col gap-4">
      <Button type="button" variant="outline" onClick={() => void regenerate()}>
        Regenerate backup codes
      </Button>
      {codes && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">New codes replace the old ones. Save them now.</p>
          <BackupCodes codes={codes} />
        </div>
      )}
      <Button type="button" variant="outline" onClick={() => void signOutEverywhere()}>
        Sign out everywhere
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
