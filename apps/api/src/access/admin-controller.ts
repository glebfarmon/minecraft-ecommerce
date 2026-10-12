import {Controller, UseGuards, applyDecorators} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import {AdminSessionGuard} from './admin-session.guard'
import {PermissionGuard} from './require-permission'

/**
 * Every admin controller (`/api/admin/<path>`). `AllowAnonymous` only lets the integration's
 * global guard pass; our session guard (with the TOTP rule) then runs for every route.
 */
export const AdminController = (path: string) =>
  applyDecorators(
    Controller(`admin/${path}`),
    AllowAnonymous(),
    UseGuards(AdminSessionGuard, PermissionGuard)
  )
