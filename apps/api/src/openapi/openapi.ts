import {toJsonSchema} from '@valibot/to-json-schema'
import * as v from 'valibot'

import {
  AdminSchema,
  AuditPageSchema,
  AuditQuerySchema,
  ChangeRoleSchema,
  CreateInviteSchema,
  InviteLookupSchema,
  InviteSchema,
  MeSchema,
  RoleInputSchema,
  RoleSchema
} from '@shop/shared/access'
import {CatalogResponseSchema, LocaleSchema} from '@shop/shared/catalog'

type JsonSchema = Record<string, unknown>

type Parameter = {name: string; in: 'query' | 'path'; required: boolean; schema: JsonSchema}
type Response = {description: string; content?: Record<string, {schema: JsonSchema}>}
type Operation = {
  summary: string
  parameters?: Parameter[]
  requestBody?: {required: true; content: {'application/json': {schema: JsonSchema}}}
  responses: Record<string, Response>
}
type Method = 'get' | 'post' | 'patch' | 'delete'

export type OpenApiDocument = {
  openapi: '3.1.0'
  info: {title: string; version: string}
  paths: Record<string, Partial<Record<Method, Operation>>>
}

/**
 * JSON Schema of a Valibot schema without the top-level `$schema` key, which OpenAPI does not want
 * inline. Normalising actions (`trim`, `toLowerCase`) have no JSON Schema form and are skipped.
 */
function schema(s: v.GenericSchema): JsonSchema {
  const json = {...(toJsonSchema(s, {errorMode: 'ignore'}) as JsonSchema)}
  delete json.$schema
  return json
}

const json = (description: string, s: v.GenericSchema): Response => ({
  description,
  content: {'application/json': {schema: schema(s)}}
})
const body = (s: v.GenericSchema): Operation['requestBody'] => ({
  required: true,
  content: {'application/json': {schema: schema(s)}}
})
const pathParam = (name: string): Parameter => ({
  name,
  in: 'path',
  required: true,
  schema: {type: 'string'}
})

/** Every admin route: a session that passed TOTP, then the route's permission. */
const guarded = {
  '401': {description: 'No session, or the admin is disabled'},
  '403': {description: '`2fa_required`, or the role lacks the permission (`forbidden`)'}
}
/** Same as `guarded`, plus the rule that an admin only grants permissions they hold. */
const guardedGrant = {
  ...guarded,
  '403': {
    description:
      '`2fa_required`, `forbidden` (the role lacks the permission), or `cannot_grant` (the target role or body holds a permission the admin lacks)'
  }
}
const invalid = {'400': {description: 'Invalid body'}}
const protectedOwner = {
  '400': {description: 'Invalid body, unknown role, or `owner_protected`'}
}
const missing = {'404': {description: 'No such record'}}

/** The API contract, generated from the same Valibot schemas the API validates with (parent spec §5). */
export function buildOpenApiDocument(): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {title: 'Shop API', version: '1'},
    paths: {
      '/api/catalog': {
        get: {
          summary: 'Public catalog: servers with ordered categories, products with prices',
          parameters: [{name: 'locale', in: 'query', required: true, schema: schema(LocaleSchema)}],
          responses: {
            '200': json(
              'Catalog in the requested locale (missing texts fall back to en)',
              CatalogResponseSchema
            ),
            '400': {description: 'Missing or unsupported locale'}
          }
        }
      },
      '/api/invite-lookup/{token}': {
        get: {
          summary: 'Anonymous: email and status of an invite link (never the role)',
          parameters: [pathParam('token')],
          responses: {
            '200': json('Invite status', InviteLookupSchema),
            '404': {description: 'Unknown token'}
          }
        }
      },
      '/api/admin/me': {
        get: {
          summary: 'The signed-in admin with their role and permissions',
          responses: {'200': json('Current admin', MeSchema), ...guarded}
        }
      },
      '/api/admin/admins': {
        get: {
          summary: 'Team members (needs admin.invite)',
          responses: {'200': json('Admins', v.array(AdminSchema)), ...guarded}
        }
      },
      '/api/admin/admins/{id}': {
        delete: {
          summary: 'Disable an admin and end their sessions (needs admin.invite)',
          parameters: [pathParam('id')],
          responses: {
            '200': json('The disabled admin', AdminSchema),
            '400': {description: '`owner_protected`'},
            ...guarded,
            ...missing
          }
        }
      },
      '/api/admin/admins/{id}/role': {
        patch: {
          summary: 'Change an admin’s role and end their sessions (needs role.write)',
          parameters: [pathParam('id')],
          requestBody: body(ChangeRoleSchema),
          responses: {
            '200': json('The updated admin', AdminSchema),
            ...protectedOwner,
            ...guardedGrant,
            ...missing
          }
        }
      },
      '/api/admin/admins/{id}/reset-2fa': {
        post: {
          summary:
            'Remove an admin’s second factor, end their sessions and mail them (needs admin.invite)',
          parameters: [pathParam('id')],
          responses: {
            '201': json('The admin, now without 2FA', AdminSchema),
            '400': {description: '`owner_protected` (only the owner may reset their own)'},
            ...guarded,
            ...missing
          }
        }
      },
      '/api/admin/invites': {
        get: {
          summary: 'Invites, open ones first (needs admin.invite)',
          responses: {'200': json('Invites', v.array(InviteSchema)), ...guarded}
        },
        post: {
          summary: 'Invite an email with a role and mail the link (needs admin.invite)',
          requestBody: body(CreateInviteSchema),
          responses: {
            '201': json('The invite (the link goes only to the email)', InviteSchema),
            ...protectedOwner,
            ...guardedGrant,
            '409': {description: '`user_exists`'},
            '503': {description: '`mail_failed`: the invite exists; resend it'}
          }
        }
      },
      '/api/admin/invites/{id}': {
        delete: {
          summary: 'Revoke an open invite (needs admin.invite)',
          parameters: [pathParam('id')],
          responses: {
            '200': json('The revoked invite', InviteSchema),
            ...guarded,
            ...missing,
            '409': {description: '`invite_closed`: already accepted or revoked'}
          }
        }
      },
      '/api/admin/invites/{id}/resend': {
        post: {
          summary: 'Mail an open invite again with a fresh link and expiry (needs admin.invite)',
          parameters: [pathParam('id')],
          responses: {
            '201': json('The invite', InviteSchema),
            ...guardedGrant,
            ...missing,
            '409': {description: '`invite_closed`: already accepted or revoked'},
            '503': {description: '`mail_failed`'}
          }
        }
      },
      '/api/admin/roles': {
        get: {
          summary: 'Roles with their permissions',
          responses: {'200': json('Roles', v.array(RoleSchema)), ...guarded}
        },
        post: {
          summary: 'Create a role (needs role.write)',
          requestBody: body(RoleInputSchema),
          responses: {
            '201': json('The role', RoleSchema),
            ...invalid,
            ...guardedGrant,
            '409': {description: '`role_name_taken`'}
          }
        }
      },
      '/api/admin/roles/{id}': {
        patch: {
          summary:
            'Edit a role; ends the sessions of its users (needs role.write; system roles are fixed)',
          parameters: [pathParam('id')],
          requestBody: body(RoleInputSchema),
          responses: {
            '200': json('The role', RoleSchema),
            '400': {description: 'Invalid body, or `owner_protected` for a system role'},
            ...guardedGrant,
            ...missing,
            '409': {description: '`role_name_taken`'}
          }
        },
        delete: {
          summary: 'Delete an unused role (needs role.write; system roles are fixed)',
          parameters: [pathParam('id')],
          responses: {
            '204': {description: 'Deleted'},
            '400': {description: '`owner_protected` for a system role'},
            ...guarded,
            ...missing,
            '409': {description: '`role_in_use`: users or open invites hold it'}
          }
        }
      },
      '/api/admin/audit': {
        get: {
          summary: 'Audit log, newest first, 50 per page (needs audit.read)',
          parameters: Object.entries(AuditQuerySchema.entries).map(([name, s]) => ({
            name,
            in: 'query' as const,
            required: false,
            schema: schema(s.wrapped)
          })),
          responses: {
            '200': json('A page of entries', AuditPageSchema),
            '400': {description: 'Invalid filter'},
            ...guarded
          }
        }
      }
    }
  }
}
