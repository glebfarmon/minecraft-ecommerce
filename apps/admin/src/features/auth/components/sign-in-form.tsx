'use client'

import {codeErrorMessage} from '@/features/auth/error-message'
import {CodeSchema, EmailSchema} from '@/features/auth/schemas'
import {authClient} from '@/lib/auth-client'
import {valibotResolver} from '@hookform/resolvers/valibot'
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
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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
    await authClient.emailOtp.sendVerificationOtp({email: value, type: 'sign-in'})
    setEmail(value)
  })

  const signIn = codeForm.handleSubmit(async ({code}) => {
    if (!email) return
    const {error: failed} = await authClient.signIn.emailOtp({email, otp: code})
    if (failed) {
      setError(
        failed.status === 403
          ? 'This email is not invited to Shop Admin.'
          : codeErrorMessage(
              failed,
              'That code did not work. Check the latest email or request a new code.'
            )
      )
      return
    }
    router.push('/2fa')
  })

  return (
    <div className="flex flex-col gap-6">
      {email === null ? (
        <form onSubmit={event => void sendCode(event)} className="flex flex-col gap-3" noValidate>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            readOnly={Boolean(invited)}
            {...emailForm.register('email')}
          />
          {emailErrors.email && (
            <p className="text-destructive text-sm">{emailErrors.email.message}</p>
          )}
          <Button type="submit">Send code</Button>
        </form>
      ) : (
        <form onSubmit={event => void signIn(event)} className="flex flex-col gap-3" noValidate>
          <p className="text-muted-foreground text-sm">
            We sent a code to {email} if it is allowed to sign in.
          </p>
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            {...codeForm.register('code')}
          />
          {codeErrors.code && <p className="text-destructive text-sm">{codeErrors.code.message}</p>}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit">Sign in</Button>
        </form>
      )}
      {googleEnabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void authClient.signIn.social({provider: 'google', callbackURL: '/2fa'})}>
          Continue with Google
        </Button>
      )}
    </div>
  )
}
