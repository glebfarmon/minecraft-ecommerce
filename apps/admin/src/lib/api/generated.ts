import {baseApi as api} from './base'

const injectedRtkApi = api.injectEndpoints({
  endpoints: build => ({
    getApiInviteLookupByToken: build.query<
      GetApiInviteLookupByTokenApiResponse,
      GetApiInviteLookupByTokenApiArg
    >({
      query: queryArg => ({url: `/api/invite-lookup/${queryArg.token}`})
    }),
    getApiAdminMe: build.query<GetApiAdminMeApiResponse, GetApiAdminMeApiArg>({
      query: () => ({url: `/api/admin/me`})
    }),
    getApiAdminAdmins: build.query<GetApiAdminAdminsApiResponse, GetApiAdminAdminsApiArg>({
      query: () => ({url: `/api/admin/admins`})
    }),
    deleteApiAdminAdminsById: build.mutation<
      DeleteApiAdminAdminsByIdApiResponse,
      DeleteApiAdminAdminsByIdApiArg
    >({
      query: queryArg => ({url: `/api/admin/admins/${queryArg.id}`, method: 'DELETE'})
    }),
    patchApiAdminAdminsByIdRole: build.mutation<
      PatchApiAdminAdminsByIdRoleApiResponse,
      PatchApiAdminAdminsByIdRoleApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/admins/${queryArg.id}/role`,
        method: 'PATCH',
        body: queryArg.body
      })
    }),
    postApiAdminAdminsByIdReset2Fa: build.mutation<
      PostApiAdminAdminsByIdReset2FaApiResponse,
      PostApiAdminAdminsByIdReset2FaApiArg
    >({
      query: queryArg => ({url: `/api/admin/admins/${queryArg.id}/reset-2fa`, method: 'POST'})
    }),
    getApiAdminInvites: build.query<GetApiAdminInvitesApiResponse, GetApiAdminInvitesApiArg>({
      query: () => ({url: `/api/admin/invites`})
    }),
    postApiAdminInvites: build.mutation<PostApiAdminInvitesApiResponse, PostApiAdminInvitesApiArg>({
      query: queryArg => ({url: `/api/admin/invites`, method: 'POST', body: queryArg.body})
    }),
    deleteApiAdminInvitesById: build.mutation<
      DeleteApiAdminInvitesByIdApiResponse,
      DeleteApiAdminInvitesByIdApiArg
    >({
      query: queryArg => ({url: `/api/admin/invites/${queryArg.id}`, method: 'DELETE'})
    }),
    postApiAdminInvitesByIdResend: build.mutation<
      PostApiAdminInvitesByIdResendApiResponse,
      PostApiAdminInvitesByIdResendApiArg
    >({
      query: queryArg => ({url: `/api/admin/invites/${queryArg.id}/resend`, method: 'POST'})
    }),
    getApiAdminRoles: build.query<GetApiAdminRolesApiResponse, GetApiAdminRolesApiArg>({
      query: () => ({url: `/api/admin/roles`})
    }),
    postApiAdminRoles: build.mutation<PostApiAdminRolesApiResponse, PostApiAdminRolesApiArg>({
      query: queryArg => ({url: `/api/admin/roles`, method: 'POST', body: queryArg.body})
    }),
    patchApiAdminRolesById: build.mutation<
      PatchApiAdminRolesByIdApiResponse,
      PatchApiAdminRolesByIdApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/roles/${queryArg.id}`,
        method: 'PATCH',
        body: queryArg.body
      })
    }),
    deleteApiAdminRolesById: build.mutation<
      DeleteApiAdminRolesByIdApiResponse,
      DeleteApiAdminRolesByIdApiArg
    >({
      query: queryArg => ({url: `/api/admin/roles/${queryArg.id}`, method: 'DELETE'})
    }),
    getApiAdminAudit: build.query<GetApiAdminAuditApiResponse, GetApiAdminAuditApiArg>({
      query: queryArg => ({
        url: `/api/admin/audit`,
        params: {
          actorId: queryArg.actorId,
          action: queryArg.action,
          from: queryArg['from'],
          to: queryArg.to,
          cursor: queryArg.cursor
        }
      })
    })
  }),
  overrideExisting: false
})
export {injectedRtkApi as api}
export type GetApiInviteLookupByTokenApiResponse = /** status 200 Invite status */ {
  email: string
  status: 'valid' | 'expired' | 'used' | 'revoked'
}
export type GetApiInviteLookupByTokenApiArg = {
  token: string
}
export type GetApiAdminMeApiResponse = /** status 200 Current admin */ {
  id: string
  email: string
  name: string
  role: {
    id: string
    name: string
    isSystem: boolean
    permissions: ('admin.invite' | 'role.write' | 'audit.read' | 'catalog.write' | 'server.rcon')[]
  }
  permissions: ('admin.invite' | 'role.write' | 'audit.read' | 'catalog.write' | 'server.rcon')[]
}
export type GetApiAdminMeApiArg = void
export type GetApiAdminAdminsApiResponse = /** status 200 Admins */ {
  id: string
  email: string
  name: string
  role: {
    id: string
    name: string
  }
  twoFactorEnabled: boolean
  disabledAt: string | null
}[]
export type GetApiAdminAdminsApiArg = void
export type DeleteApiAdminAdminsByIdApiResponse = /** status 200 The disabled admin */ {
  id: string
  email: string
  name: string
  role: {
    id: string
    name: string
  }
  twoFactorEnabled: boolean
  disabledAt: string | null
}
export type DeleteApiAdminAdminsByIdApiArg = {
  id: string
}
export type PatchApiAdminAdminsByIdRoleApiResponse = /** status 200 The updated admin */ {
  id: string
  email: string
  name: string
  role: {
    id: string
    name: string
  }
  twoFactorEnabled: boolean
  disabledAt: string | null
}
export type PatchApiAdminAdminsByIdRoleApiArg = {
  id: string
  body: {
    roleId: string
  }
}
export type PostApiAdminAdminsByIdReset2FaApiResponse =
  /** status 201 The admin, now without 2FA */ {
    id: string
    email: string
    name: string
    role: {
      id: string
      name: string
    }
    twoFactorEnabled: boolean
    disabledAt: string | null
  }
export type PostApiAdminAdminsByIdReset2FaApiArg = {
  id: string
}
export type GetApiAdminInvitesApiResponse = /** status 200 Invites */ {
  id: string
  email: string
  role: {
    id: string
    name: string
  }
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
}[]
export type GetApiAdminInvitesApiArg = void
export type PostApiAdminInvitesApiResponse =
  /** status 201 The invite (the link goes only to the email) */ {
    id: string
    email: string
    role: {
      id: string
      name: string
    }
    expiresAt: string
    acceptedAt: string | null
    revokedAt: string | null
  }
export type PostApiAdminInvitesApiArg = {
  body: {
    email: string
    roleId: string
  }
}
export type DeleteApiAdminInvitesByIdApiResponse = /** status 200 The revoked invite */ {
  id: string
  email: string
  role: {
    id: string
    name: string
  }
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
}
export type DeleteApiAdminInvitesByIdApiArg = {
  id: string
}
export type PostApiAdminInvitesByIdResendApiResponse = /** status 201 The invite */ {
  id: string
  email: string
  role: {
    id: string
    name: string
  }
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
}
export type PostApiAdminInvitesByIdResendApiArg = {
  id: string
}
export type GetApiAdminRolesApiResponse = /** status 200 Roles */ {
  id: string
  name: string
  isSystem: boolean
  permissions: ('admin.invite' | 'role.write' | 'audit.read' | 'catalog.write' | 'server.rcon')[]
}[]
export type GetApiAdminRolesApiArg = void
export type PostApiAdminRolesApiResponse = /** status 201 The role */ {
  id: string
  name: string
  isSystem: boolean
  permissions: ('admin.invite' | 'role.write' | 'audit.read' | 'catalog.write' | 'server.rcon')[]
}
export type PostApiAdminRolesApiArg = {
  body: {
    name: string
    permissions: ('admin.invite' | 'role.write' | 'audit.read' | 'catalog.write' | 'server.rcon')[]
  }
}
export type PatchApiAdminRolesByIdApiResponse = /** status 200 The role */ {
  id: string
  name: string
  isSystem: boolean
  permissions: ('admin.invite' | 'role.write' | 'audit.read' | 'catalog.write' | 'server.rcon')[]
}
export type PatchApiAdminRolesByIdApiArg = {
  id: string
  body: {
    name: string
    permissions: ('admin.invite' | 'role.write' | 'audit.read' | 'catalog.write' | 'server.rcon')[]
  }
}
export type DeleteApiAdminRolesByIdApiResponse = unknown
export type DeleteApiAdminRolesByIdApiArg = {
  id: string
}
export type GetApiAdminAuditApiResponse = /** status 200 A page of entries */ {
  entries: {
    id: string
    actor: {
      id: string
      email: string
    } | null
    action: string
    entityType: string | null
    entityId: string | null
    before: any
    after: any
    ip: string
    createdAt: string
  }[]
  nextCursor: string | null
}
export type GetApiAdminAuditApiArg = {
  actorId?: string
  action?: string
  from?: string
  to?: string
  cursor?: string
}
export const {
  useGetApiInviteLookupByTokenQuery,
  useGetApiAdminMeQuery,
  useGetApiAdminAdminsQuery,
  useDeleteApiAdminAdminsByIdMutation,
  usePatchApiAdminAdminsByIdRoleMutation,
  usePostApiAdminAdminsByIdReset2FaMutation,
  useGetApiAdminInvitesQuery,
  usePostApiAdminInvitesMutation,
  useDeleteApiAdminInvitesByIdMutation,
  usePostApiAdminInvitesByIdResendMutation,
  useGetApiAdminRolesQuery,
  usePostApiAdminRolesMutation,
  usePatchApiAdminRolesByIdMutation,
  useDeleteApiAdminRolesByIdMutation,
  useGetApiAdminAuditQuery
} = injectedRtkApi
