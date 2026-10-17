'use client'

import {codeErrorMessage} from '@/features/auth/error-message'
import {BackupSchema, CodeSchema} from '@/features/auth/schemas'
import {authClient} from '@/lib/auth-client'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

export function TotpChallenge() {
  const router = useRouter()
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setError(codeErrorMessage(failed, 'That code did not work.'))
      return
    }
    router.replace('/')
  })

  return (
    <form onSubmit={event => void verify(event)} className="flex flex-col gap-3" noValidate>
      <Label htmlFor="code">{useBackup ? 'Backup code' : 'Code from the app'}</Label>
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
          {errors.code.message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit">Verify</Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setUseBackup(value => !value)
          setError(null)
          form.reset({code: ''})
        }}>
        {useBackup ? 'Use the app code' : 'Use a backup code'}
      </Button>
    </form>
  )
}
