import {SignInForm} from '@/features/auth/components/sign-in-form'

import type {InviteLookup} from '@shop/shared/access'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'
const MESSAGES = {
  expired: 'This invite has expired. Ask for a new one.',
  used: 'This invite was already used. Sign in instead.',
  revoked: 'This invite was cancelled.'
}

export default async function InvitePage({params}: {params: Promise<{token: string}>}) {
  const {token} = await params
  const res = await fetch(`${API_ORIGIN}/api/invite-lookup/${encodeURIComponent(token)}`, {
    cache: 'no-store'
  })
  const invite = res.ok ? ((await res.json()) as InviteLookup) : null
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6 py-24">
      <h1 className="text-2xl font-semibold">Join Shop Admin</h1>
      {invite?.status === 'valid' ? (
        <SignInForm email={invite.email} googleEnabled={process.env.GOOGLE_SIGN_IN === 'on'} />
      ) : (
        <p role="alert">{invite ? MESSAGES[invite.status] : 'This invite link is not valid.'}</p>
      )}
    </section>
  )
}
