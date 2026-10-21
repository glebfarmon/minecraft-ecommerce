import {FORM_MESSAGES} from '@/lib/validation-messages'
import * as v from 'valibot'

import {CURRENCIES} from '@shop/shared/catalog'
import {toMinor} from '@shop/shared/catalog-admin'
import {PROMO_CODE_PATTERN, PROMO_KINDS} from '@shop/shared/promo'

const isPercent = (text: string) =>
  /^\d{1,3}$/.test(text) && Number(text) >= 1 && Number(text) <= 100

/**
 * The promo editor's fields as typed. Dates are `yyyy-mm-ddTHH:mm` in UTC, or '' for none; the
 * amount is text like `5.00`; the currency is kept for a percent code but not sent (`toPromoInput`).
 */
export const PromoFormSchema = v.pipe(
  v.object({
    code: v.pipe(
      v.string(),
      v.trim(),
      v.toUpperCase(),
      v.regex(PROMO_CODE_PATTERN, FORM_MESSAGES.promoCodeFormat)
    ),
    kind: v.picklist(PROMO_KINDS),
    value: v.pipe(v.string(), v.trim()),
    currency: v.picklist(CURRENCIES),
    maxUses: v.pipe(
      v.string(),
      v.trim(),
      v.check(t => t === '' || /^[1-9]\d{0,8}$/.test(t), FORM_MESSAGES.maxUsesFormat)
    ),
    startsAt: v.string(),
    endsAt: v.string(),
    isActive: v.boolean(),
    categoryIds: v.array(v.string()),
    productIds: v.array(v.string())
  }),
  v.forward(
    v.partialCheck(
      [['kind'], ['value']],
      f => f.kind !== 'PERCENT' || isPercent(f.value),
      FORM_MESSAGES.percentRange
    ),
    ['value']
  ),
  v.forward(
    v.partialCheck(
      [['kind'], ['value']],
      f => f.kind !== 'FIXED' || (toMinor(f.value) ?? 0) > 0,
      FORM_MESSAGES.amountFormat
    ),
    ['value']
  ),
  v.forward(
    v.partialCheck(
      [['startsAt'], ['endsAt']],
      f => f.startsAt === '' || f.endsAt === '' || f.endsAt > f.startsAt,
      FORM_MESSAGES.endAfterStart
    ),
    ['endsAt']
  )
)
export type PromoForm = v.InferInput<typeof PromoFormSchema>
