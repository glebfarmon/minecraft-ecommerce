import {AuthCard} from '@/features/auth/components/auth-card'
import {SignInForm} from '@/features/auth/components/sign-in-form'
import {getMe} from '@/lib/session'
import {getSiteTitle} from '@/lib/site-name'
import {getTranslations} from 'next-intl/server'
import {redirect} from 'next/navigation'

export default async function LoginPage() {
  const t = await getTranslations('auth')
  const me = await getMe()
  const site = await getSiteTitle()
  if (me.state === 'ok') redirect('/')
  if (me.state === '2fa') redirect('/2fa')
  return (
    <AuthCard title={t('signInToAdmin', {site})}>
      <SignInForm site={site} googleEnabled={process.env.GOOGLE_SIGN_IN === 'on'} />
    </AuthCard>
  )
}
