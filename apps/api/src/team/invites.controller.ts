import {Body, Delete, Get, Param, Post, Req} from '@nestjs/common'

import {type CreateInvite, CreateInviteSchema, type Invite} from '@shop/shared/access'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {InvitesService} from './invites.service'

@AdminController('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  @RequirePermission('admin.invite')
  list(): Promise<Invite[]> {
    return this.invites.list()
  }

  @Post()
  @RequirePermission('admin.invite')
  @Audited('invite.create', 'invite')
  create(
    @Body(new ValibotPipe(CreateInviteSchema)) body: CreateInvite,
    @Req() req: AuditableRequest
  ): Promise<Invite> {
    const admin = adminOf(req)
    return this.invites.create(body, admin.userId, admin.permissions)
  }

  @Post(':id/resend')
  @RequirePermission('admin.invite')
  @Audited('invite.resend', 'invite')
  resend(@Param('id') id: string, @Req() req: AuditableRequest): Promise<Invite> {
    return this.invites.resend(id, adminOf(req).permissions)
  }

  @Delete(':id')
  @RequirePermission('admin.invite')
  @Audited('invite.revoke', 'invite')
  revoke(@Param('id') id: string, @Req() req: AuditableRequest): Promise<Invite> {
    return this.invites.revoke(id, before => {
      req.auditBefore = before
    })
  }
}
