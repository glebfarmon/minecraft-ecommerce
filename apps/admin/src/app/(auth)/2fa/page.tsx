import {AuthCard} from '@/features/auth/components/auth-card'
import {TotpChallenge} from '@/features/auth/components/totp-challenge'
import {TotpSetup} from '@/features/auth/components/totp-setup'
import {getMe} from '@/lib/session'
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

export default async function TwoFactorPage() {
  const me = await getMe()
  if (me.state === 'ok') redirect('/')
  if (me.state === 'signed-out') redirect('/login')
  // Better Auth's own session tells whether TOTP is set up yet.
  const res = await fetch(`${API_ORIGIN}/api/auth/get-session`, {
    headers: {cookie: (await cookies()).toString()},
    cache: 'no-store'
  })
  if (!res.ok) throw new Error(`GET /api/auth/get-session failed with ${String(res.status)}`)
  const session = (await res.json()) as {user?: {twoFactorEnabled?: boolean}} | null
  return (
    <AuthCard title="Two-factor authentication">
      {session?.user?.twoFactorEnabled ? <TotpChallenge /> : <TotpSetup />}
    </AuthCard>
  )
}
