import {Body, Delete, Get, HttpCode, Param, Patch, Post, Req} from '@nestjs/common'

import {type Role, type RoleInput, RoleInputSchema} from '@shop/shared/access'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {RolesService} from './roles.service'

@AdminController('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** Every admin may read the roles (the team page shows them). */
  @Get()
  list(): Promise<Role[]> {
    return this.roles.list()
  }

  @Post()
  @RequirePermission('role.write')
  @Audited('role.create', 'role')
  create(
    @Body(new ValibotPipe(RoleInputSchema)) body: RoleInput,
    @Req() req: AuditableRequest
  ): Promise<Role> {
    return this.roles.create(body, adminOf(req).permissions)
  }

  @Patch(':id')
  @RequirePermission('role.write')
  @Audited('role.update', 'role')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(RoleInputSchema)) body: RoleInput,
    @Req() req: AuditableRequest
  ): Promise<Role> {
    return this.roles.update(id, body, adminOf(req).permissions, before => {
      req.auditBefore = before
    })
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('role.write')
  @Audited('role.delete', 'role')
  remove(@Param('id') id: string, @Req() req: AuditableRequest): Promise<void> {
    return this.roles.remove(id, before => {
      req.auditBefore = before
    })
  }
}
