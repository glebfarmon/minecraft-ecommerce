import {Get, Req} from '@nestjs/common'

import type {Me} from '@shop/shared/access'

import {AdminController} from '../access/admin-controller'
import {type AdminRequest, adminOf} from '../access/admin-request'

@AdminController('me')
export class MeController {
  @Get()
  get(@Req() req: AdminRequest): Me {
    const admin = adminOf(req)
    return {
      id: admin.userId,
      email: admin.email,
      name: admin.name,
      role: {...admin.role, permissions: admin.permissions},
      permissions: admin.permissions
    }
  }
}
