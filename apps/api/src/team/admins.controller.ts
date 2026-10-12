import {Body, Delete, Get, Param, Patch, Post, Req} from '@nestjs/common'

import {type Admin, type ChangeRole, ChangeRoleSchema} from '@shop/shared/access'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {AdminsService} from './admins.service'

@AdminController('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @RequirePermission('admin.invite')
  list(): Promise<Admin[]> {
    return this.admins.list()
  }

  @Patch(':id/role')
  @RequirePermission('role.write')
  @Audited('admin.role_change', 'user')
  changeRole(
    @Param('id') id: string,
    @Body(new ValibotPipe(ChangeRoleSchema)) body: ChangeRole,
    @Req() req: AuditableRequest
  ): Promise<Admin> {
    return this.admins.changeRole(id, body.roleId, before => {
      req.auditBefore = before
    })
  }

  @Post(':id/reset-2fa')
  @RequirePermission('admin.invite')
  @Audited('admin.2fa_reset', 'user')
  resetTwoFactor(@Param('id') id: string, @Req() req: AuditableRequest): Promise<Admin> {
    return this.admins.resetTwoFactor(id, adminOf(req).userId, before => {
      req.auditBefore = before
    })
  }

  @Delete(':id')
  @RequirePermission('admin.invite')
  @Audited('admin.remove', 'user')
  remove(@Param('id') id: string, @Req() req: AuditableRequest): Promise<Admin> {
    return this.admins.disable(id, before => {
      req.auditBefore = before
    })
  }
}
