'use client'

import {codeErrorMessage} from '@/features/auth/error-message'
import {CodeSchema, EmailSchema} from '@/features/auth/schemas'
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

export function SignInForm({
  email: invited,
  googleEnabled
}: {
  email?: string
  googleEnabled: boolean
}) {
  const t = useTranslations('auth')
  const errorText = useErrorText()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useMessage()
  const emailForm = useForm({
    resolver: valibotResolver(EmailSchema),
    defaultValues: {email: invited ?? ''}
  })
  const codeForm = useForm({resolver: valibotResolver(CodeSchema), defaultValues: {code: ''}})
  const emailErrors = useFormState({control: emailForm.control}).errors
  const codeErrors = useFormState({control: codeForm.control}).errors

  const sendCode = emailForm.handleSubmit(async ({email: value}) => {
    setError(null)
    // The API answers the same for every email (no enumeration); invite-only is enforced on sign-in.
    try {
      const {error: failed} = await authClient.emailOtp.sendVerificationOtp({
        email: value,
        type: 'sign-in'
      })
      if (failed) {
        setError(codeErrorMessage(failed, t('sendCodeFailed'), t))
        return
      }
    } catch {
      setError(t('sendCodeFailed'))
      return
    }
    setEmail(value)
  })

  const signIn = codeForm.handleSubmit(async ({code}) => {
    if (!email) return
    const {error: failed} = await authClient.signIn.emailOtp({email, otp: code})
    if (failed) {
      setError(
        failed.status === 403 ? t('notInvited') : codeErrorMessage(failed, t('codeFailedEmail'), t)
      )
      return
    }
    router.push('/2fa')
  })

  return (
    <div className="flex flex-col gap-6">
      {email === null ? (
        <form onSubmit={event => void sendCode(event)} className="flex flex-col gap-3" noValidate>
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            readOnly={Boolean(invited)}
            aria-invalid={Boolean(emailErrors.email)}
            aria-describedby={emailErrors.email ? 'email-error' : undefined}
            {...emailForm.register('email')}
          />
          {emailErrors.email && (
            <p id="email-error" role="alert" className="text-sm text-destructive">
              {errorText(emailErrors.email.message)}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit">{t('sendCode')}</Button>
        </form>
      ) : (
        <form onSubmit={event => void signIn(event)} className="flex flex-col gap-3" noValidate>
          <p className="text-sm text-muted-foreground">{t('codeSent', {email})}</p>
          <Label htmlFor="code">{t('n6DigitCode')}</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-invalid={Boolean(codeErrors.code)}
            aria-describedby={codeErrors.code ? 'code-error' : undefined}
            {...codeForm.register('code')}
          />
          {codeErrors.code && (
            <p id="code-error" role="alert" className="text-sm text-destructive">
              {errorText(codeErrors.code.message)}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit">{t('signIn')}</Button>
        </form>
      )}
      {googleEnabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void authClient.signIn.social({provider: 'google', callbackURL: '/2fa'})}>
          {t('continueWithGoogle')}
        </Button>
      )}
    </div>
  )
}
