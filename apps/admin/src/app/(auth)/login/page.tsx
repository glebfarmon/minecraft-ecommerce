import {AuthCard} from '@/features/auth/components/auth-card'
import {SignInForm} from '@/features/auth/components/sign-in-form'
import {getMe} from '@/lib/session'
import {redirect} from 'next/navigation'

export default async function LoginPage() {
  const me = await getMe()
  if (me.state === 'ok') redirect('/')
  if (me.state === '2fa') redirect('/2fa')
  return (
    <AuthCard title="Sign in to Shop Admin">
      <SignInForm googleEnabled={process.env.GOOGLE_SIGN_IN === 'on'} />
    </AuthCard>
  )
}
