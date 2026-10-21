import type {PromoForm} from '@/features/promo/schemas'

import {fromMinor, toMinor} from '@shop/shared/catalog-admin'
import type {AdminPromoCode, PromoCodeInput} from '@shop/shared/promo'

export const EMPTY_PROMO_FORM: PromoForm = {
  code: '',
  kind: 'PERCENT',
  value: '',
  currency: 'EUR',
  maxUses: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
  categoryIds: [],
  productIds: []
}

/** An ISO time as the editor's UTC `yyyy-mm-ddTHH:mm`, and back. */
export const toUtcField = (iso: string | null) => (iso ? iso.slice(0, 16) : '')
export const fromUtcField = (field: string) => (field ? `${field}:00.000Z` : null)

export function toPromoForm(c: Omit<AdminPromoCode, 'status' | 'createdAt'>): PromoForm {
  return {
    code: c.code,
    kind: c.kind,
    value: c.kind === 'FIXED' ? fromMinor(c.value) : String(c.value),
    currency: c.currency ?? 'EUR',
    maxUses: c.maxUses === null ? '' : String(c.maxUses),
    startsAt: toUtcField(c.startsAt),
    endsAt: toUtcField(c.endsAt),
    isActive: c.isActive,
    categoryIds: c.categoryIds,
    productIds: c.productIds
  }
}

/** The API body of validated form values. A percent code has no currency. */
export function toPromoInput(f: PromoForm): PromoCodeInput {
  const fixed = f.kind === 'FIXED'
  return {
    code: f.code.trim().toUpperCase(),
    kind: f.kind,
    value: fixed ? (toMinor(f.value) ?? 0) : Number(f.value),
    currency: fixed ? f.currency : null,
    maxUses: f.maxUses.trim() === '' ? null : Number(f.maxUses),
    startsAt: fromUtcField(f.startsAt),
    endsAt: fromUtcField(f.endsAt),
    isActive: f.isActive,
    categoryIds: f.categoryIds,
    productIds: f.productIds
  }
}
