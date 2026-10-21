import {AuthCard} from '@/features/auth/components/auth-card'
import {SignInForm} from '@/features/auth/components/sign-in-form'
import {getSiteTitle} from '@/lib/site-name'
import {getTranslations} from 'next-intl/server'

import type {InviteLookup} from '@shop/shared/access'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

export default async function InvitePage({params}: {params: Promise<{token: string}>}) {
  const t = await getTranslations('auth')
  const {token} = await params
  const [site, res] = await Promise.all([
    getSiteTitle(),
    fetch(`${API_ORIGIN}/api/invite-lookup/${encodeURIComponent(token)}`, {cache: 'no-store'})
  ])
  const invite = res.ok ? ((await res.json()) as InviteLookup) : null
  return (
    <AuthCard title={t('joinAdmin', {site})}>
      {invite?.status === 'valid' ? (
        <SignInForm
          site={site}
          email={invite.email}
          googleEnabled={process.env.GOOGLE_SIGN_IN === 'on'}
        />
      ) : (
        <p role="alert">{invite ? t(`invite_${invite.status}`) : t('inviteInvalid')}</p>
      )}
    </AuthCard>
  )
}
