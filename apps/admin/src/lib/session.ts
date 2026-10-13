import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import 'server-only'

import type {Me} from '@shop/shared/access'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

export type MeState = {state: 'ok'; me: Me} | {state: 'signed-out'} | {state: '2fa'}

/** The signed-in admin, read with the visitor's cookies (the API owns the session). */
export async function getMe(): Promise<MeState> {
  const cookie = (await cookies()).toString()
  const res = await fetch(`${API_ORIGIN}/api/admin/me`, {
    headers: {cookie},
    cache: 'no-store',
    signal: AbortSignal.timeout(5000)
  })
  if (res.ok) return {state: 'ok', me: (await res.json()) as Me}
  if (res.status === 403) return {state: '2fa'}
  return {state: 'signed-out'}
}

export async function requireMe(): Promise<Me> {
  const result = await getMe()
  if (result.state === 'signed-out') redirect('/login')
  if (result.state === '2fa') redirect('/2fa')
  return result.me
}
