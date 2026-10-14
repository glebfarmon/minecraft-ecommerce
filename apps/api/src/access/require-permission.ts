import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata
} from '@nestjs/common'
import {Reflector} from '@nestjs/core'

import {type Permission, hasPermission} from '@shop/shared/access'

import {type AdminRequest, adminOf} from './admin-request'

const KEY = 'requiredPermissions'

/** The route needs every listed permission; runs after `AdminSessionGuard`. */
export const RequirePermission = (...perms: Permission[]) => SetMetadata(KEY, perms)

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const needed =
      this.reflector.getAllAndOverride<Permission[] | undefined>(KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? []
    const {permissions} = adminOf(context.switchToHttp().getRequest<AdminRequest>())
    if (needed.every(p => hasPermission(permissions, p))) return true
    throw new ForbiddenException({statusCode: 403, message: 'forbidden'})
  }
}
