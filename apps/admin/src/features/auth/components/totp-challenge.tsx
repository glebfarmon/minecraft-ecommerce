'use client'

import {codeErrorMessage} from '@/features/auth/error-message'
import {BackupSchema, CodeSchema} from '@/features/auth/schemas'
import {useErrorText} from '@/hooks/use-error-text'
import {useMessage} from '@/hooks/use-message'
import {authClient} from '@/lib/auth-client'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

export function TotpChallenge() {
  const t = useTranslations('auth')
  const errorText = useErrorText()
  const router = useRouter()
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useMessage()
  const form = useForm({
    resolver: valibotResolver(useBackup ? BackupSchema : CodeSchema),
    defaultValues: {code: ''}
  })
  const errors = useFormState({control: form.control}).errors

  const verify = form.handleSubmit(async ({code}) => {
    const {error: failed} = useBackup
      ? await authClient.twoFactor.verifyBackupCode({code, trustDevice: false})
      : await authClient.twoFactor.verifyTotp({code, trustDevice: false})
    if (failed) {
      setError(codeErrorMessage(failed, t('codeFailed'), t))
      return
    }
    router.replace('/')
  })

  return (
    <form onSubmit={event => void verify(event)} className="flex flex-col gap-3" noValidate>
      <Label htmlFor="code">{useBackup ? t('backupCode') : t('codeFromTheApp')}</Label>
      <Input
        key={useBackup ? 'backup' : 'totp'}
        id="code"
        inputMode={useBackup ? 'text' : 'numeric'}
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
      <Button type="submit">{t('verify')}</Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setUseBackup(value => !value)
          setError(null)
          form.reset({code: ''})
        }}>
        {useBackup ? t('useAppCode') : t('useBackupCode')}
      </Button>
    </form>
  )
}
