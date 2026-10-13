import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import {cache} from 'react'
import 'server-only'

import type {Me} from '@shop/shared/access'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

export type MeState = {state: 'ok'; me: Me} | {state: 'signed-out'} | {state: '2fa'}

/**
 * The signed-in admin, read with the visitor's cookies (the API owns the session). Cached per
 * request so the layout and the page share one fetch. Anything other than "no session" (401) or
 * "TOTP pending" (403 2fa_required) throws, so an API outage is an error, not a silent sign-out.
 */
export const getMe = cache(async (): Promise<MeState> => {
  const cookie = (await cookies()).toString()
  const res = await fetch(`${API_ORIGIN}/api/admin/me`, {
    headers: {cookie},
    cache: 'no-store',
    signal: AbortSignal.timeout(5000)
  })
  if (res.ok) return {state: 'ok', me: (await res.json()) as Me}
  if (res.status === 401) return {state: 'signed-out'}
  if (res.status === 403) {
    const body = (await res.json().catch(() => null)) as {message?: unknown} | null
    if (body?.message === '2fa_required') return {state: '2fa'}
  }
  throw new Error(`GET /api/admin/me failed with ${String(res.status)}`)
})

export async function requireMe(): Promise<Me> {
  const result = await getMe()
  if (result.state === 'signed-out') redirect('/login')
  if (result.state === '2fa') redirect('/2fa')
  return result.me
}
