'use client'

import {BackupCodes} from '@/features/auth/components/backup-codes'
import {codeErrorMessage} from '@/features/auth/error-message'
import {CodeSchema} from '@/features/auth/schemas'
import {authClient} from '@/lib/auth-client'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useRouter} from 'next/navigation'
import {QRCodeSVG} from 'qrcode.react'
import {useEffect, useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

type Enrollment = {totpURI: string; backupCodes: string[]}

function secretOf(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

export function TotpSetup() {
  const router = useRouter()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm({resolver: valibotResolver(CodeSchema), defaultValues: {code: ''}})
  const errors = useFormState({control: form.control}).errors

  useEffect(() => {
    let active = true
    void authClient.twoFactor.enable({}).then(({data, error: failed}) => {
      if (!active) return
      if (failed || data.method !== 'totp') setLoadError(true)
      else setEnrollment(data)
    })
    return () => {
      active = false
    }
  }, [])

  const confirm = form.handleSubmit(async ({code}) => {
    const {error: failed} = await authClient.twoFactor.verifyTotp({code})
    if (failed) {
      setError(codeErrorMessage(failed, 'That code did not work. Check the app and try again.'))
      return
    }
    setError(null)
    setConfirmed(true)
  })

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not start two-factor setup. Reload the page to try again.
      </p>
    )
  }
  if (!enrollment) return <p className="text-sm text-muted-foreground">Preparing setup…</p>

  if (confirmed) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Two-factor is on. Save these backup codes now; each works once and they are not shown
          again.
        </p>
        <BackupCodes codes={enrollment.backupCodes} />
        <Button
          type="button"
          onClick={() => {
            router.replace('/')
          }}>
          I saved them
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={event => void confirm(event)} className="flex flex-col gap-3" noValidate>
      <p className="text-sm">
        Scan this code with an authenticator app, then enter the 6-digit code it shows. Backup codes
        appear after you confirm, and work only once setup is complete.
      </p>
      <QRCodeSVG
        value={enrollment.totpURI}
        role="img"
        aria-label="QR code for your authenticator app"
        className="bg-white p-2"
      />
      <p className="text-xs text-muted-foreground">
        Cannot scan? Enter this key:{' '}
        <code data-testid="totp-secret">{secretOf(enrollment.totpURI)}</code>
      </p>
      <Label htmlFor="code">Code from the app</Label>
      <Input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-invalid={Boolean(errors.code)}
        aria-describedby={errors.code ? 'code-error' : undefined}
        {...form.register('code')}
      />
      {errors.code && (
        <p id="code-error" role="alert" className="text-sm text-destructive">
          {errors.code.message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit">Confirm</Button>
    </form>
  )
}
