import {Body, Controller, HttpCode, Post} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import {
  type ValidatePromoRequest,
  ValidatePromoRequestSchema,
  type ValidatePromoResponse
} from '@shop/shared/promo'

import {ValibotPipe} from '../../common/valibot.pipe'
import {OrdersService} from '../orders.service'
import {PromoService} from './promo.service'

@AllowAnonymous()
@Controller('promo')
export class PromoController {
  constructor(
    private readonly orders: OrdersService,
    private readonly promo: PromoService
  ) {}

  @Post('validate')
  @HttpCode(200)
  async validate(
    @Body(new ValibotPipe(ValidatePromoRequestSchema)) body: ValidatePromoRequest
  ): Promise<ValidatePromoResponse> {
    // The locale only picks product names, which a check does not return.
    const {discountLines} = await this.orders.priceRequest(body.lines, body.currency, 'en')
    const result = await this.promo.evaluate(body.code, discountLines, body.currency)
    if (!result.ok) return result
    const subtotalMinor = discountLines.reduce((sum, l) => sum + l.amountMinor, 0)
    return {
      ok: true,
      code: result.promo.code,
      subtotalMinor,
      discountMinor: result.discountMinor,
      totalMinor: subtotalMinor - result.discountMinor
    }
  }
}
