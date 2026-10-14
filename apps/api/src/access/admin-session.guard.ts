import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import {fromNodeHeaders} from 'better-auth/node'

import {PrismaService} from '../prisma/prisma.service'
import type {AdminRequest} from './admin-request'
import {PermissionCache} from './permission-cache'

export type AdminSession = {
  user: {id: string; email: string; name: string}
  session: {id: string; twoFactorVerifiedAt?: Date | null}
}
/** Reads the Better Auth session for request headers; `getAuth().api.getSession` in the app. */
export type SessionReader = (headers: Headers) => Promise<AdminSession | null>
export const SESSION_READER = Symbol('SESSION_READER')

/**
 * Every admin route: a live session of a non-disabled user with a role, whose session passed
 * TOTP or a backup code (spec decision #5). Attaches `req.admin`.
 */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    @Inject(SESSION_READER) private readonly readSession: SessionReader,
    private readonly cache: PermissionCache,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>()
    const result = await this.readSession(fromNodeHeaders(req.headers))
    if (!result) throw new UnauthorizedException()
    const user = await this.prisma.user.findUnique({
      where: {id: result.user.id},
      select: {disabledAt: true, roleId: true}
    })
    if (!user?.roleId || user.disabledAt) throw new UnauthorizedException()
    if (!result.session.twoFactorVerifiedAt)
      throw new ForbiddenException({statusCode: 403, message: '2fa_required'})
    const role = await this.cache.get(user.roleId)
    req.admin = {
      userId: result.user.id,
      sessionId: result.session.id,
      email: result.user.email,
      name: result.user.name,
      role: {id: user.roleId, name: role.name, isSystem: role.isSystem},
      permissions: role.permissions
    }
    return true
  }
}
