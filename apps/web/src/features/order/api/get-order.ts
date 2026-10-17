import * as v from 'valibot'

import {type PublicOrder, PublicOrderSchema} from '@shop/shared/orders'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

/** The order a player sees after paying; `null` when there is none. Never cached: the status changes within seconds. */
export async function getOrder(publicId: string): Promise<PublicOrder | null> {
  const res = await fetch(`${API_ORIGIN}/api/orders/${publicId}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`order ${String(res.status)}`)
  return v.parse(PublicOrderSchema, await res.json())
}
