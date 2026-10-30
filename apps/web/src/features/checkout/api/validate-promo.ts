import * as v from 'valibot'

import {ValidatePromoResponseSchema} from '@shop/shared/promo'
import type {ValidatePromoRequest, ValidatePromoResponse} from '@shop/shared/promo'

export type ValidatePromoResult =
  ValidatePromoResponse | {ok: false; reason: 'network' | 'rate_limited'}

const readJson = async (res: Pick<Response, 'json'>): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/** Same-origin, like `createOrder`. Never throws: every outcome is a reason the field can show. */
export async function validatePromo(
  body: ValidatePromoRequest,
  fetchFn: typeof fetch = fetch
): Promise<ValidatePromoResult> {
  let res: Response
  try {
    res = await fetchFn('/api/promo/validate', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body)
    })
  } catch {
    return {ok: false, reason: 'network'}
  }

  if (res.status === 200) {
    const parsed = v.safeParse(ValidatePromoResponseSchema, await readJson(res))
    return parsed.success ? parsed.output : {ok: false, reason: 'network'}
  }
  if (res.status === 429) return {ok: false, reason: 'rate_limited'}
  // The API answers odd codes with not_found; a 400 means the request itself was off, which to the player is the same.
  if (res.status === 400) return {ok: false, reason: 'not_found'}
  return {ok: false, reason: 'network'}
}
