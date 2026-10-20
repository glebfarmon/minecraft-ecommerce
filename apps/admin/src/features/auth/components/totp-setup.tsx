'use client'

import {BackupCodes} from '@/features/auth/components/backup-codes'
import {codeErrorMessage} from '@/features/auth/error-message'
import {CodeSchema} from '@/features/auth/schemas'
import {useErrorText} from '@/hooks/use-error-text'
import {useMessage} from '@/hooks/use-message'
import {authClient} from '@/lib/auth-client'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useTranslations} from 'next-intl'
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
  const t = useTranslations('auth')
  const errorText = useErrorText()
  const router = useRouter()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useMessage()
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
      setError(codeErrorMessage(failed, t('codeFailedApp'), t))
      return
    }
    setError(null)
    setConfirmed(true)
  })

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t('couldNotStartTwoFactorSetup')}
      </p>
    )
  }
  if (!enrollment) return <p className="text-sm text-muted-foreground">{t('preparingSetup')}</p>

  if (confirmed) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t('twoFactorIsOnSaveThese')}</p>
        <BackupCodes codes={enrollment.backupCodes} />
        <Button
          type="button"
          onClick={() => {
            router.replace('/')
          }}>
          {t('iSavedThem')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={event => void confirm(event)} className="flex flex-col gap-3" noValidate>
      <p className="text-sm">{t('scanThisCodeWithAnAuthenticator')}</p>
      <QRCodeSVG
        value={enrollment.totpURI}
        role="img"
        aria-label={t('qrCodeForYourAuthenticatorApp')}
        className="bg-white p-2"
      />
      <p className="text-xs text-muted-foreground">
        {t('cannotScan')} <code data-testid="totp-secret">{secretOf(enrollment.totpURI)}</code>
      </p>
      <Label htmlFor="code">{t('codeFromTheApp')}</Label>
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
          {errorText(errors.code.message)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit">{t('confirm')}</Button>
    </form>
  )
}
