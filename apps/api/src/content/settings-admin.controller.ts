import {Body, Get, Put, Req} from '@nestjs/common'

import {type AdminSiteSettings, SiteSettingsUpdateSchema} from '@shop/shared/content'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {SettingsAdminService} from './settings-admin.service'

@AdminController('content/settings')
export class SettingsAdminController {
  constructor(private readonly settings: SettingsAdminService) {}

  @Get()
  @RequirePermission('content.write')
  get(): Promise<AdminSiteSettings> {
    return this.settings.get()
  }

  @Put()
  @RequirePermission('content.write')
  @Audited('settings.update', 'settings')
  update(
    @Body(new ValibotPipe(SiteSettingsUpdateSchema)) body: AdminSiteSettings,
    @Req() req: AuditableRequest
  ): Promise<AdminSiteSettings> {
    return this.settings.update(body, adminOf(req).email, before => {
      req.auditBefore = before
    })
  }
}
