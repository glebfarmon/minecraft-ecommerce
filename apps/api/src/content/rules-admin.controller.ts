import {Body, Get, Param, Post, Put, Query, Req} from '@nestjs/common'

import {
  type RulesDraft,
  type RulesDraftUpdate,
  RulesDraftUpdateSchema,
  type RulesVersionList,
  RulesVersionsQuerySchema
} from '@shop/shared/content'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {notFound} from '../common/http-errors'
import {ValibotPipe} from '../common/valibot.pipe'
import {RulesAdminService} from './rules-admin.service'

@AdminController('content/rules')
export class RulesAdminController {
  constructor(private readonly rules: RulesAdminService) {}

  @Get('draft')
  @RequirePermission('content.write')
  draft(): Promise<RulesDraft> {
    return this.rules.draft()
  }

  @Put('draft')
  @RequirePermission('content.write')
  @Audited('rules.draft', 'rules')
  save(
    @Body(new ValibotPipe(RulesDraftUpdateSchema)) body: RulesDraftUpdate,
    @Req() req: AuditableRequest
  ): Promise<RulesDraft> {
    return this.rules.save(body, adminOf(req).email, before => {
      req.auditBefore = before
    })
  }

  @Post('publish')
  @RequirePermission('content.write')
  @Audited('rules.publish', 'rules')
  publish(@Req() req: AuditableRequest): Promise<{id: number; publishedAt: string}> {
    return this.rules.publish(adminOf(req).email)
  }

  @Get('versions')
  @RequirePermission('content.write')
  versions(
    @Query(new ValibotPipe(RulesVersionsQuerySchema)) query: {cursor?: number}
  ): Promise<RulesVersionList> {
    return this.rules.versions(query.cursor)
  }

  @Post('versions/:id/restore')
  @RequirePermission('content.write')
  @Audited('rules.restore', 'rules')
  restore(@Param('id') id: string, @Req() req: AuditableRequest): Promise<RulesDraft> {
    if (!/^[1-9]\d{0,9}$/.test(id)) throw notFound()
    return this.rules.restore(Number(id), adminOf(req).email, before => {
      req.auditBefore = before
    })
  }
}
