import * as v from 'valibot'

import {CurrencySchema} from './catalog'
import {OrderLinesSchema} from './order-lines'

export const PROMO_CODE_PATTERN = /^[A-Z0-9]{3,32}$/

export const PROMO_REASONS = [
  'not_found',
  'not_started',
  'expired',
  'used_up',
  'not_applicable',
  'wrong_currency'
] as const
export const PromoReasonSchema = v.picklist(PROMO_REASONS)
export type PromoReason = (typeof PROMO_REASONS)[number]

export const PROMO_KINDS = ['PERCENT', 'FIXED'] as const
export const PromoKindSchema = v.picklist(PROMO_KINDS)
export type PromoKind = (typeof PROMO_KINDS)[number]

export const PROMO_STATUSES = ['active', 'scheduled', 'expired', 'used_up', 'disabled'] as const
export const PromoStatusSchema = v.picklist(PROMO_STATUSES)
export type PromoStatus = (typeof PROMO_STATUSES)[number]

const MAX_INT = 2_147_483_647
const MAX_SCOPE_IDS = 200
const Iso = v.pipe(v.string(), v.isoTimestamp())
const Minor = v.pipe(v.number(), v.integer(), v.minValue(0))

/** Admin input: a strict code. */
export const PromoCodeSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toUpperCase(),
  v.regex(PROMO_CODE_PATTERN)
)
/** Public input: no pattern, so odd input answers `not_found` instead of a validation error. */
export const LoosePromoCodeSchema = v.pipe(v.string(), v.trim(), v.toUpperCase(), v.maxLength(64))

export const ValidatePromoRequestSchema = v.strictObject({
  code: LoosePromoCodeSchema,
  currency: CurrencySchema,
  lines: OrderLinesSchema
})
export type ValidatePromoRequest = v.InferOutput<typeof ValidatePromoRequestSchema>

export const ValidatePromoResponseSchema = v.variant('ok', [
  v.object({
    ok: v.literal(true),
    code: v.string(),
    subtotalMinor: Minor,
    discountMinor: Minor,
    totalMinor: Minor
  }),
  v.object({ok: v.literal(false), reason: PromoReasonSchema})
])
export type ValidatePromoResponse = v.InferOutput<typeof ValidatePromoResponseSchema>

export const AdminPromoCodeSchema = v.object({
  id: v.string(),
  code: v.string(),
  kind: PromoKindSchema,
  value: v.number(),
  currency: v.nullable(CurrencySchema),
  maxUses: v.nullable(v.pipe(v.number(), v.integer())),
  usedCount: Minor,
  startsAt: v.nullable(Iso),
  endsAt: v.nullable(Iso),
  isActive: v.boolean(),
  status: PromoStatusSchema,
  locked: v.boolean(),
  categoryIds: v.array(v.string()),
  productIds: v.array(v.string()),
  version: v.number(),
  createdAt: Iso
})
export type AdminPromoCode = v.InferOutput<typeof AdminPromoCodeSchema>

const PromoCodeInputEntries = {
  code: PromoCodeSchema,
  kind: PromoKindSchema,
  value: v.pipe(v.number(), v.integer(), v.maxValue(MAX_INT)),
  currency: v.nullable(CurrencySchema),
  maxUses: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_INT))),
  startsAt: v.nullable(Iso),
  endsAt: v.nullable(Iso),
  isActive: v.boolean(),
  categoryIds: v.pipe(v.array(v.string()), v.maxLength(MAX_SCOPE_IDS)),
  productIds: v.pipe(v.array(v.string()), v.maxLength(MAX_SCOPE_IDS))
}

export const PromoCodeInputSchema = v.pipe(
  v.object(PromoCodeInputEntries),
  v.forward(
    v.check(i => i.kind !== 'PERCENT' || (i.value >= 1 && i.value <= 100), 'percent out of range'),
    ['value']
  ),
  v.forward(
    v.check(i => i.kind !== 'FIXED' || i.value >= 1, 'fixed amount must be positive'),
    ['value']
  ),
  v.forward(
    v.check(
      i => (i.kind === 'PERCENT' ? i.currency === null : i.currency !== null),
      'currency does not fit the kind'
    ),
    ['currency']
  ),
  v.forward(
    v.check(
      i =>
        i.startsAt === null || i.endsAt === null || Date.parse(i.endsAt) > Date.parse(i.startsAt),
      'endsAt must be after startsAt'
    ),
    ['endsAt']
  )
)

export type PromoCodeInput = v.InferOutput<typeof PromoCodeInputSchema>

export const PromoCodeUpdateSchema = v.intersect([
  PromoCodeInputSchema,
  v.object({version: v.pipe(v.number(), v.integer())})
])
export type PromoCodeUpdate = v.InferOutput<typeof PromoCodeUpdateSchema>

export const PromoActiveSchema = v.object({
  isActive: v.boolean(),
  version: v.pipe(v.number(), v.integer())
})
export type PromoActive = v.InferOutput<typeof PromoActiveSchema>
