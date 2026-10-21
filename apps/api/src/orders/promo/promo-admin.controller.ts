import {Body, Delete, Get, HttpCode, Param, Patch, Post, Query, Req} from '@nestjs/common'

import {VersionQuerySchema} from '@shop/shared/catalog-admin'
import {
  type AdminPromoCode,
  type PromoActive,
  PromoActiveSchema,
  type PromoCodeInput,
  PromoCodeInputSchema,
  type PromoCodeUpdate,
  PromoCodeUpdateSchema
} from '@shop/shared/promo'

import {AdminController} from '../../access/admin-controller'
import {RequirePermission} from '../../access/require-permission'
import {type AuditableRequest, Audited} from '../../audit/audit.interceptor'
import {ValibotPipe} from '../../common/valibot.pipe'
import {PromoAdminService} from './promo-admin.service'

@AdminController('promo-codes')
@RequirePermission('promo.write')
export class PromoAdminController {
  constructor(private readonly promos: PromoAdminService) {}

  @Get()
  list(): Promise<AdminPromoCode[]> {
    return this.promos.list()
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminPromoCode> {
    return this.promos.get(id)
  }

  @Post()
  @Audited('promo.create', 'promo_code')
  create(
    @Body(new ValibotPipe(PromoCodeInputSchema)) body: PromoCodeInput
  ): Promise<AdminPromoCode> {
    return this.promos.create(body)
  }

  @Patch(':id')
  @Audited('promo.update', 'promo_code')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(PromoCodeUpdateSchema)) body: PromoCodeUpdate,
    @Req() req: AuditableRequest
  ): Promise<AdminPromoCode> {
    return this.promos.update(id, body, before => {
      req.auditBefore = before
    })
  }

  @Patch(':id/active')
  @Audited('promo.update', 'promo_code')
  setActive(
    @Param('id') id: string,
    @Body(new ValibotPipe(PromoActiveSchema)) body: PromoActive,
    @Req() req: AuditableRequest
  ): Promise<AdminPromoCode> {
    return this.promos.setActive(id, body, before => {
      req.auditBefore = before
    })
  }

  @Delete(':id')
  @HttpCode(204)
  @Audited('promo.delete', 'promo_code')
  remove(
    @Param('id') id: string,
    @Query(new ValibotPipe(VersionQuerySchema)) query: {version: number},
    @Req() req: AuditableRequest
  ): Promise<void> {
    return this.promos.remove(id, query.version, before => {
      req.auditBefore = before
    })
  }
}
