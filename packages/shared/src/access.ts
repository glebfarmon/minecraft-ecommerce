import * as v from 'valibot'

/** Every permission the admin API checks. Later sub-projects append theirs. */
export const PERMISSIONS = [
  'admin.invite',
  'role.write',
  'audit.read',
  'catalog.write',
  'server.rcon',
  'content.write',
  'order.read',
  'promo.write',
  'delivery.resolve'
] as const
export type Permission = (typeof PERMISSIONS)[number]
export const PermissionSchema = v.picklist(PERMISSIONS)

export type SystemRoleName = 'OWNER' | 'ADMIN' | 'SUPPORT'
/** Seeded roles. OWNER always has every permission, whatever the table says. */
export const SYSTEM_ROLES: Record<SystemRoleName, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: [
    'admin.invite',
    'audit.read',
    'catalog.write',
    'server.rcon',
    'content.write',
    'order.read',
    'promo.write',
    'delivery.resolve'
  ],
  SUPPORT: ['order.read']
}

export const hasPermission = (granted: readonly Permission[], needed: Permission): boolean =>
  granted.includes(needed)

const Id = v.pipe(v.string(), v.minLength(1))
const Email = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email())
const Timestamp = v.pipe(v.string(), v.isoTimestamp())
const RoleRef = v.object({id: Id, name: v.string()})

export const RoleSchema = v.object({
  id: Id,
  name: v.string(),
  isSystem: v.boolean(),
  permissions: v.array(PermissionSchema)
})
export type Role = v.InferOutput<typeof RoleSchema>

export const RoleInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(40)),
  permissions: v.array(PermissionSchema)
})
export type RoleInput = v.InferOutput<typeof RoleInputSchema>

export const MeSchema = v.object({
  id: Id,
  email: v.string(),
  name: v.string(),
  role: RoleSchema,
  permissions: v.array(PermissionSchema)
})
export type Me = v.InferOutput<typeof MeSchema>

export const AdminSchema = v.object({
  id: Id,
  email: v.string(),
  name: v.string(),
  role: RoleRef,
  twoFactorEnabled: v.boolean(),
  disabledAt: v.nullable(Timestamp)
})
export type Admin = v.InferOutput<typeof AdminSchema>

export const InviteSchema = v.object({
  id: Id,
  email: v.string(),
  role: RoleRef,
  expiresAt: Timestamp,
  acceptedAt: v.nullable(Timestamp),
  revokedAt: v.nullable(Timestamp)
})
export type Invite = v.InferOutput<typeof InviteSchema>

export const CreateInviteSchema = v.object({email: Email, roleId: Id})
export type CreateInvite = v.InferOutput<typeof CreateInviteSchema>

export const ChangeRoleSchema = v.object({roleId: Id})
export type ChangeRole = v.InferOutput<typeof ChangeRoleSchema>

export const InviteLookupSchema = v.object({
  email: v.string(),
  status: v.picklist(['valid', 'expired', 'used', 'revoked'])
})
export type InviteLookup = v.InferOutput<typeof InviteLookupSchema>

/** Rows per audit page the admin can choose; the API defaults to 50. */
export const AUDIT_PAGE_SIZES = [25, 50, 100] as const
export type AuditPageSize = (typeof AUDIT_PAGE_SIZES)[number]

export const AuditQuerySchema = v.object({
  actorId: v.optional(Id),
  action: v.optional(v.pipe(v.string(), v.maxLength(80))),
  from: v.optional(Timestamp),
  to: v.optional(Timestamp),
  cursor: v.optional(Id),
  // A query string value, so the sizes arrive as text.
  limit: v.optional(
    v.pipe(
      v.picklist(AUDIT_PAGE_SIZES.map(String) as ['25', '50', '100']),
      v.transform(n => Number(n) as AuditPageSize)
    )
  )
})
export type AuditQuery = v.InferOutput<typeof AuditQuerySchema>

export const AuditEntrySchema = v.object({
  id: Id,
  actor: v.nullable(v.object({id: Id, email: v.string()})),
  action: v.string(),
  entityType: v.nullable(v.string()),
  entityId: v.nullable(v.string()),
  before: v.unknown(),
  after: v.unknown(),
  ip: v.string(),
  createdAt: Timestamp
})
export type AuditEntry = v.InferOutput<typeof AuditEntrySchema>

export const AuditPageSchema = v.object({
  entries: v.array(AuditEntrySchema),
  nextCursor: v.nullable(Id)
})
export type AuditPage = v.InferOutput<typeof AuditPageSchema>
