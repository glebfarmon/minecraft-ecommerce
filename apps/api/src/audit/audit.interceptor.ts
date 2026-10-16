import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata
} from '@nestjs/common'
import {Reflector} from '@nestjs/core'
import {type Observable, tap} from 'rxjs'

import type {AdminRequest} from '../access/admin-request'
import {clientIp} from '../common/client-ip'
import {AuditService} from './audit.service'
import {redact} from './redact'

type Meta = {action: string; entityType: string}
const KEY = 'audit'
/** Names the audit action of a mutating admin handler, e.g. `@Audited('role.update', 'role')`. */
export const Audited = (action: string, entityType: string) =>
  SetMetadata(KEY, {action, entityType} satisfies Meta)

/**
 * The Express request seen through the Node type: handlers that change a row set `auditBefore` first,
 * and `auditEntityId` when the row has no `:id` in the path or `id` in the response.
 */
export type AuditableRequest = AdminRequest & {
  params?: Record<string, string | undefined>
  originalUrl?: string
  auditBefore?: unknown
  auditEntityId?: string
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuditableRequest>()
    if (req.method === 'GET') return next.handle()
    const meta = this.reflector.getAllAndOverride<Meta | undefined>(KEY, [
      context.getHandler(),
      context.getClass()
    ])
    return next.handle().pipe(
      tap(body => {
        const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? ''
        const bodyId = (body as {id?: string | number} | null | undefined)?.id
        const id =
          req.auditEntityId ??
          req.params?.id ??
          (typeof bodyId === 'string' || typeof bodyId === 'number' ? String(bodyId) : undefined)
        this.audit
          .record({
            actorId: req.admin?.userId ?? null,
            action: meta?.action ?? `${(req.method ?? '').toLowerCase()} ${path}`,
            entityType: meta?.entityType,
            entityId: id,
            before: redact(req.auditBefore),
            after: redact(body),
            // Same rule as every limiter and the sign-in rows; `req.ip` would be the proxy peer.
            ip: clientIp(req.headers, req.socket.remoteAddress)
          })
          .catch((error: unknown) => {
            console.error('audit: record failed', error)
          })
      })
    )
  }
}
