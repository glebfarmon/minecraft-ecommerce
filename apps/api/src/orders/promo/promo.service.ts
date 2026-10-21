import {Injectable} from '@nestjs/common'

import type {Currency} from '@shop/shared/catalog'
import {PROMO_CODE_PATTERN, type PromoReason} from '@shop/shared/promo'

import {PrismaService} from '../../prisma/prisma.service'
import {type DiscountLine, checkAvailable, computeDiscount} from './promo-rules'

export type PromoEvaluation =
  | {ok: true; promo: {id: string; code: string}; discountMinor: number}
  | {ok: false; reason: PromoReason}

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Looks the live code up and prices the discount. Reads only; the use is counted at payment. */
  async evaluate(
    code: string,
    lines: DiscountLine[],
    currency: Currency,
    now = new Date()
  ): Promise<PromoEvaluation> {
    if (!PROMO_CODE_PATTERN.test(code)) return {ok: false, reason: 'not_found'}
    const row = await this.prisma.promoCode.findFirst({
      where: {code, deletedAt: null},
      include: {categories: true, products: true}
    })
    const rules = row && {
      ...row,
      categoryIds: row.categories.map(c => c.categoryId),
      productIds: row.products.map(p => p.productId)
    }
    const reason = checkAvailable(rules, now)
    if (reason || !rules) return {ok: false, reason: reason ?? 'not_found'}
    const result = computeDiscount(rules, lines, currency)
    if ('reason' in result) return {ok: false, reason: result.reason}
    return {ok: true, promo: {id: rules.id, code: rules.code}, discountMinor: result.discountMinor}
  }
}
