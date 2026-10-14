import {SignInForm} from '@/features/auth/components/sign-in-form'
import {getMe} from '@/lib/session'
import {redirect} from 'next/navigation'

export default async function LoginPage() {
  const me = await getMe()
  if (me.state === 'ok') redirect('/')
  if (me.state === '2fa') redirect('/2fa')
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6 py-24">
      <h1 className="text-2xl font-semibold">Sign in to Shop Admin</h1>
      <SignInForm googleEnabled={process.env.GOOGLE_SIGN_IN === 'on'} />
    </section>
  )
}
