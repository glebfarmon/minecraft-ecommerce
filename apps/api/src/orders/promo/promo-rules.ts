import type {Currency} from '@shop/shared/catalog'
import type {PromoKind, PromoReason, PromoStatus} from '@shop/shared/promo'

/** Smallest charge Stripe accepts, per currency (minor units). */
export const STRIPE_MINIMUM: Record<Currency, number> = {EUR: 50, PLN: 200}

export type PromoRow = {
  kind: PromoKind
  value: number
  currency: Currency | null
  maxUses: number | null
  usedCount: number
  startsAt: Date | null
  endsAt: Date | null
  isActive: boolean
  deletedAt: Date | null
  categoryIds: string[]
  productIds: string[]
}

/** One order line: `amountMinor` is unit price × quantity. */
export type DiscountLine = {productId: string; categoryId: string; amountMinor: number}

type Window = Pick<PromoRow, 'maxUses' | 'usedCount' | 'startsAt' | 'endsAt'>

function windowReason(row: Window, now: Date): 'not_started' | 'expired' | 'used_up' | null {
  if (row.startsAt && now < row.startsAt) return 'not_started'
  if (row.endsAt && now >= row.endsAt) return 'expired'
  if (row.maxUses !== null && row.usedCount >= row.maxUses) return 'used_up'
  return null
}

export function checkAvailable(row: PromoRow | null, now: Date): PromoReason | null {
  if (!row || row.deletedAt || !row.isActive) return 'not_found'
  return windowReason(row, now)
}

export function computeDiscount(
  row: PromoRow,
  lines: DiscountLine[],
  currency: Currency
): {discountMinor: number} | {reason: 'not_applicable' | 'wrong_currency'} {
  if (row.kind === 'FIXED' && row.currency !== currency) return {reason: 'wrong_currency'}

  const allInScope = row.categoryIds.length === 0 && row.productIds.length === 0
  const eligible = lines
    .filter(
      l =>
        allInScope || row.productIds.includes(l.productId) || row.categoryIds.includes(l.categoryId)
    )
    .reduce((sum, l) => sum + l.amountMinor, 0)
  if (eligible <= 0) return {reason: 'not_applicable'}

  const raw =
    row.kind === 'PERCENT'
      ? Math.floor((eligible * row.value) / 100)
      : Math.min(row.value, eligible)
  const subtotal = lines.reduce((sum, l) => sum + l.amountMinor, 0)
  const discountMinor = Math.min(raw, subtotal - STRIPE_MINIMUM[currency])
  return discountMinor <= 0 ? {reason: 'not_applicable'} : {discountMinor}
}

export function promoStatus(row: PromoRow, now: Date): PromoStatus {
  if (!row.isActive) return 'disabled'
  const reason = windowReason(row, now)
  if (reason === 'not_started') return 'scheduled'
  return reason ?? 'active'
}
