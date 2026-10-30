import * as v from 'valibot'

import {CreateOrderResponseSchema} from '@shop/shared/orders'
import type {CreateOrderRequest} from '@shop/shared/orders'
import {PromoReasonSchema} from '@shop/shared/promo'
import type {PromoReason} from '@shop/shared/promo'

export type CreateOrderResult =
  | {ok: true; publicId: string; redirectUrl: string}
  | {ok: false; error: 'unavailable'; lines: {server: string; slug: string}[]}
  | {ok: false; error: 'promo'; reason: PromoReason}
  | {ok: false; error: 'turnstile' | 'rate_limited' | 'unavailable_payments' | 'invalid'}

const UnavailableSchema = v.object({
  issues: v.object({lines: v.array(v.object({server: v.string(), slug: v.string()}))})
})

/** The code failed at order time (e.g. used up since Apply); no order was created. */
const PromoConflictSchema = v.object({
  message: v.literal('promo'),
  issues: v.object({reason: PromoReasonSchema})
})

const readJson = async (res: Pick<Response, 'json'>): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/** Same-origin: Traefik routes `/api/*` to the API, as for the status poll. */
export async function createOrder(
  body: CreateOrderRequest,
  fetchFn: typeof fetch = fetch
): Promise<CreateOrderResult> {
  let res: Response
  try {
    res = await fetchFn('/api/orders', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body)
    })
  } catch {
    return {ok: false, error: 'unavailable_payments'}
  }

  if (res.status === 201) {
    const parsed = v.safeParse(CreateOrderResponseSchema, await readJson(res))
    return parsed.success
      ? {ok: true, publicId: parsed.output.publicId, redirectUrl: parsed.output.redirectUrl}
      : {ok: false, error: 'unavailable_payments'}
  }
  if (res.status === 409) {
    const json = await readJson(res)
    const promo = v.safeParse(PromoConflictSchema, json)
    if (promo.success) return {ok: false, error: 'promo', reason: promo.output.issues.reason}
    const parsed = v.safeParse(UnavailableSchema, json)
    return parsed.success
      ? {ok: false, error: 'unavailable', lines: parsed.output.issues.lines}
      : {ok: false, error: 'invalid'}
  }
  if (res.status === 400) {
    const json = (await readJson(res)) as {message?: unknown} | null
    return {ok: false, error: json?.message === 'turnstile_failed' ? 'turnstile' : 'invalid'}
  }
  if (res.status === 429) return {ok: false, error: 'rate_limited'}
  return {ok: false, error: 'unavailable_payments'}
}
