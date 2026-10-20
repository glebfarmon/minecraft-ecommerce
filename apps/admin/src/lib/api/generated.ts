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
    }),
    listCatalogServers: build.query<ListCatalogServersApiResponse, ListCatalogServersApiArg>({
      query: () => ({url: `/api/admin/catalog/servers`})
    }),
    createCatalogServer: build.mutation<CreateCatalogServerApiResponse, CreateCatalogServerApiArg>({
      query: queryArg => ({url: `/api/admin/catalog/servers`, method: 'POST', body: queryArg.body})
    }),
    orderCatalogServers: build.mutation<OrderCatalogServersApiResponse, OrderCatalogServersApiArg>({
      query: queryArg => ({
        url: `/api/admin/catalog/servers/order`,
        method: 'PUT',
        body: queryArg.body
      })
    }),
    getCatalogServer: build.query<GetCatalogServerApiResponse, GetCatalogServerApiArg>({
      query: queryArg => ({url: `/api/admin/catalog/servers/${queryArg.id}`})
    }),
    updateCatalogServer: build.mutation<UpdateCatalogServerApiResponse, UpdateCatalogServerApiArg>({
      query: queryArg => ({
        url: `/api/admin/catalog/servers/${queryArg.id}`,
        method: 'PATCH',
        body: queryArg.body
      })
    }),
    deleteCatalogServer: build.mutation<DeleteCatalogServerApiResponse, DeleteCatalogServerApiArg>({
      query: queryArg => ({
        url: `/api/admin/catalog/servers/${queryArg.id}`,
        method: 'DELETE',
        params: {
          version: queryArg.version
        }
      })
    }),
    setCatalogServerCategories: build.mutation<
      SetCatalogServerCategoriesApiResponse,
      SetCatalogServerCategoriesApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/servers/${queryArg.id}/categories`,
        method: 'PUT',
        body: queryArg.body
      })
    }),
    updateCatalogServerRcon: build.mutation<
      UpdateCatalogServerRconApiResponse,
      UpdateCatalogServerRconApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/servers/${queryArg.id}/rcon`,
        method: 'PUT',
        body: queryArg.body
      })
    }),
    testCatalogServerRcon: build.mutation<
      TestCatalogServerRconApiResponse,
      TestCatalogServerRconApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/servers/${queryArg.id}/rcon/test`,
        method: 'POST'
      })
    }),
    listCatalogCategories: build.query<
      ListCatalogCategoriesApiResponse,
      ListCatalogCategoriesApiArg
    >({
      query: () => ({url: `/api/admin/catalog/categories`})
    }),
    createCatalogCategory: build.mutation<
      CreateCatalogCategoryApiResponse,
      CreateCatalogCategoryApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/categories`,
        method: 'POST',
        body: queryArg.body
      })
    }),
    updateCatalogCategory: build.mutation<
      UpdateCatalogCategoryApiResponse,
      UpdateCatalogCategoryApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/categories/${queryArg.id}`,
        method: 'PATCH',
        body: queryArg.body
      })
    }),
    deleteCatalogCategory: build.mutation<
      DeleteCatalogCategoryApiResponse,
      DeleteCatalogCategoryApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/categories/${queryArg.id}`,
        method: 'DELETE',
        params: {
          version: queryArg.version
        }
      })
    }),
    listCatalogProducts: build.query<ListCatalogProductsApiResponse, ListCatalogProductsApiArg>({
      query: queryArg => ({
        url: `/api/admin/catalog/products`,
        params: {
          serverId: queryArg.serverId,
          categoryId: queryArg.categoryId
        }
      })
    }),
    createCatalogProduct: build.mutation<
      CreateCatalogProductApiResponse,
      CreateCatalogProductApiArg
    >({
      query: queryArg => ({url: `/api/admin/catalog/products`, method: 'POST', body: queryArg.body})
    }),
    getCatalogProduct: build.query<GetCatalogProductApiResponse, GetCatalogProductApiArg>({
      query: queryArg => ({url: `/api/admin/catalog/products/${queryArg.id}`})
    }),
    updateCatalogProduct: build.mutation<
      UpdateCatalogProductApiResponse,
      UpdateCatalogProductApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/products/${queryArg.id}`,
        method: 'PATCH',
        body: queryArg.body
      })
    }),
    deleteCatalogProduct: build.mutation<
      DeleteCatalogProductApiResponse,
      DeleteCatalogProductApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/products/${queryArg.id}`,
        method: 'DELETE',
        params: {
          version: queryArg.version
        }
      })
    }),
    orderCatalogProducts: build.mutation<
      OrderCatalogProductsApiResponse,
      OrderCatalogProductsApiArg
    >({
      query: queryArg => ({
        url: `/api/admin/catalog/servers/${queryArg.serverId}/categories/${queryArg.categoryId}/products/order`,
        method: 'PUT',
        body: queryArg.body
      })
    }),
    getRulesDraft: build.query<GetRulesDraftApiResponse, GetRulesDraftApiArg>({
      query: () => ({url: `/api/admin/content/rules/draft`})
    }),
    saveRulesDraft: build.mutation<SaveRulesDraftApiResponse, SaveRulesDraftApiArg>({
      query: queryArg => ({
        url: `/api/admin/content/rules/draft`,
        method: 'PUT',
        body: queryArg.body
      })
    }),
    publishRules: build.mutation<PublishRulesApiResponse, PublishRulesApiArg>({
      query: queryArg => ({
        url: `/api/admin/content/rules/publish`,
        method: 'POST',
        body: queryArg.body
      })
    }),
    listRulesVersions: build.query<ListRulesVersionsApiResponse, ListRulesVersionsApiArg>({
      query: queryArg => ({
        url: `/api/admin/content/rules/versions`,
        params: {
          cursor: queryArg.cursor
        }
      })
    }),
    restoreRulesVersion: build.mutation<RestoreRulesVersionApiResponse, RestoreRulesVersionApiArg>({
      query: queryArg => ({
        url: `/api/admin/content/rules/versions/${queryArg.id}/restore`,
        method: 'POST'
      })
    }),
    listContentMessages: build.query<ListContentMessagesApiResponse, ListContentMessagesApiArg>({
      query: queryArg => ({
        url: `/api/admin/content/messages`,
        params: {
          locale: queryArg.locale
        }
      })
    }),
    setContentMessage: build.mutation<SetContentMessageApiResponse, SetContentMessageApiArg>({
      query: queryArg => ({
        url: `/api/admin/content/messages/${queryArg.locale}/${queryArg.key}`,
        method: 'PUT',
        body: queryArg.body
      })
    }),
    resetContentMessage: build.mutation<ResetContentMessageApiResponse, ResetContentMessageApiArg>({
      query: queryArg => ({
        url: `/api/admin/content/messages/${queryArg.locale}/${queryArg.key}`,
        method: 'DELETE'
      })
    }),
    getContentSettings: build.query<GetContentSettingsApiResponse, GetContentSettingsApiArg>({
      query: () => ({url: `/api/admin/content/settings`})
    }),
    updateContentSettings: build.mutation<
      UpdateContentSettingsApiResponse,
      UpdateContentSettingsApiArg
    >({
      query: queryArg => ({url: `/api/admin/content/settings`, method: 'PUT', body: queryArg.body})
    }),
    listAdminOrders: build.query<ListAdminOrdersApiResponse, ListAdminOrdersApiArg>({
      query: queryArg => ({
        url: `/api/admin/orders`,
        params: {
          q: queryArg.q,
          status: queryArg.status,
          cursor: queryArg.cursor
        }
      })
    }),
    getAdminOrder: build.query<GetAdminOrderApiResponse, GetAdminOrderApiArg>({
      query: queryArg => ({url: `/api/admin/orders/${queryArg.id}`})
    }),
    getOrderStats: build.query<GetOrderStatsApiResponse, GetOrderStatsApiArg>({
      query: queryArg => ({
        url: `/api/admin/stats/orders`,
        params: {
          range: queryArg.range,
          currency: queryArg.currency
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
    permissions: (
      | 'admin.invite'
      | 'role.write'
      | 'audit.read'
      | 'catalog.write'
      | 'server.rcon'
      | 'content.write'
      | 'order.read'
    )[]
  }
  permissions: (
    | 'admin.invite'
    | 'role.write'
    | 'audit.read'
    | 'catalog.write'
    | 'server.rcon'
    | 'content.write'
    | 'order.read'
  )[]
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
  permissions: (
    | 'admin.invite'
    | 'role.write'
    | 'audit.read'
    | 'catalog.write'
    | 'server.rcon'
    | 'content.write'
    | 'order.read'
  )[]
}[]
export type GetApiAdminRolesApiArg = void
export type PostApiAdminRolesApiResponse = /** status 201 The role */ {
  id: string
  name: string
  isSystem: boolean
  permissions: (
    | 'admin.invite'
    | 'role.write'
    | 'audit.read'
    | 'catalog.write'
    | 'server.rcon'
    | 'content.write'
    | 'order.read'
  )[]
}
export type PostApiAdminRolesApiArg = {
  body: {
    name: string
    permissions: (
      | 'admin.invite'
      | 'role.write'
      | 'audit.read'
      | 'catalog.write'
      | 'server.rcon'
      | 'content.write'
      | 'order.read'
    )[]
  }
}
export type PatchApiAdminRolesByIdApiResponse = /** status 200 The role */ {
  id: string
  name: string
  isSystem: boolean
  permissions: (
    | 'admin.invite'
    | 'role.write'
    | 'audit.read'
    | 'catalog.write'
    | 'server.rcon'
    | 'content.write'
    | 'order.read'
  )[]
}
export type PatchApiAdminRolesByIdApiArg = {
  id: string
  body: {
    name: string
    permissions: (
      | 'admin.invite'
      | 'role.write'
      | 'audit.read'
      | 'catalog.write'
      | 'server.rcon'
      | 'content.write'
      | 'order.read'
    )[]
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
export type ListCatalogServersApiResponse = /** status 200 Servers */ {
  id: string
  slug: string
  name: string
  accent: string
  onAccent: string
  isActive: boolean
  sort: number
  version: number
  productCount: number
  /** Attached categories in display order */
  categories: {
    id: string
    slug: string
    name: string
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  }[]
  /** RCON address; null unless the viewer has `server.rcon` */
  rcon: {
    host: string | null
    port: number | null
  } | null
  rconPasswordSet: boolean
}[]
export type ListCatalogServersApiArg = void
export type CreateCatalogServerApiResponse = /** status 201 The new server */ {
  id: string
  slug: string
  name: string
  accent: string
  onAccent: string
  isActive: boolean
  sort: number
  version: number
  productCount: number
  /** Attached categories in display order */
  categories: {
    id: string
    slug: string
    name: string
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  }[]
  /** RCON address; null unless the viewer has `server.rcon` */
  rcon: {
    host: string | null
    port: number | null
  } | null
  rconPasswordSet: boolean
}
export type CreateCatalogServerApiArg = {
  body: {
    /** URL segment: 1–40 of a–z, 0–9 and "-". Also stored in shoppers’ cart cookies. */
    slug: string
    name: string
    /** Tab and button color on the storefront */
    accent: string
    /** Text color on top of the accent */
    onAccent: string
  }
}
export type OrderCatalogServersApiResponse = /** status 200 Servers in the new order */ {
  id: string
  slug: string
  name: string
  accent: string
  onAccent: string
  isActive: boolean
  sort: number
  version: number
  productCount: number
  /** Attached categories in display order */
  categories: {
    id: string
    slug: string
    name: string
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  }[]
  /** RCON address; null unless the viewer has `server.rcon` */
  rcon: {
    host: string | null
    port: number | null
  } | null
  rconPasswordSet: boolean
}[]
export type OrderCatalogServersApiArg = {
  body: {
    /** Every id of the list, in the new order. A different set of ids is 409 `stale`. */
    ids: string[]
    /** The order the client saw and moved from. If the current order differs, the reorder is 409 `stale`. */
    base: string[]
  }
}
export type GetCatalogServerApiResponse = /** status 200 The server */ {
  id: string
  slug: string
  name: string
  accent: string
  onAccent: string
  isActive: boolean
  sort: number
  version: number
  productCount: number
  /** Attached categories in display order */
  categories: {
    id: string
    slug: string
    name: string
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  }[]
  /** RCON address; null unless the viewer has `server.rcon` */
  rcon: {
    host: string | null
    port: number | null
  } | null
  rconPasswordSet: boolean
}
export type GetCatalogServerApiArg = {
  id: string
}
export type UpdateCatalogServerApiResponse = /** status 200 The updated server */ {
  id: string
  slug: string
  name: string
  accent: string
  onAccent: string
  isActive: boolean
  sort: number
  version: number
  productCount: number
  /** Attached categories in display order */
  categories: {
    id: string
    slug: string
    name: string
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  }[]
  /** RCON address; null unless the viewer has `server.rcon` */
  rcon: {
    host: string | null
    port: number | null
  } | null
  rconPasswordSet: boolean
}
export type UpdateCatalogServerApiArg = {
  id: string
  body: {
    /** URL segment: 1–40 of a–z, 0–9 and "-". Also stored in shoppers’ cart cookies. */
    slug: string
    name: string
    /** Tab and button color on the storefront */
    accent: string
    /** Text color on top of the accent */
    onAccent: string
    /** Shown on the storefront */
    isActive: boolean
    /** The version you read. If someone saved since, the write fails with 409 `stale`. */
    version: number
  }
}
export type DeleteCatalogServerApiResponse = unknown
export type DeleteCatalogServerApiArg = {
  id: string
  version: string
}
export type SetCatalogServerCategoriesApiResponse =
  /** status 200 The server with its categories */ {
    id: string
    slug: string
    name: string
    accent: string
    onAccent: string
    isActive: boolean
    sort: number
    version: number
    productCount: number
    /** Attached categories in display order */
    categories: {
      id: string
      slug: string
      name: string
      icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
    }[]
    /** RCON address; null unless the viewer has `server.rcon` */
    rcon: {
      host: string | null
      port: number | null
    } | null
    rconPasswordSet: boolean
  }
export type SetCatalogServerCategoriesApiArg = {
  id: string
  body: {
    /** Categories attached to the server, in display order; missing ones are detached */
    categoryIds: string[]
    /** The attached categories the client saw, in their order. If the current list differs, the request is 409 `stale`. */
    base: string[]
  }
}
export type UpdateCatalogServerRconApiResponse = /** status 200 The server */ {
  id: string
  slug: string
  name: string
  accent: string
  onAccent: string
  isActive: boolean
  sort: number
  version: number
  productCount: number
  /** Attached categories in display order */
  categories: {
    id: string
    slug: string
    name: string
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  }[]
  /** RCON address; null unless the viewer has `server.rcon` */
  rcon: {
    host: string | null
    port: number | null
  } | null
  rconPasswordSet: boolean
}
export type UpdateCatalogServerRconApiArg = {
  id: string
  body: {
    host: string | null
    port: number | null
    /** New RCON password; omit to keep the stored one */
    password?: string
    /** true removes the stored password */
    clearPassword?: boolean
  }
}
export type TestCatalogServerRconApiResponse =
  | /** status 200 `{ok: true, ms}` or `{ok: false, error}` */ {
      ok: true
      /** Round trip in ms */
      ms: number
    }
  | {
      ok: any
      error: 'timeout' | 'unreachable' | 'auth_failed' | 'decrypt_failed'
    }
export type TestCatalogServerRconApiArg = {
  id: string
}
export type ListCatalogCategoriesApiResponse = /** status 200 Categories */ {
  id: string
  slug: string
  icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  names: {
    en: string
    pl: string
  }
  version: number
  productCount: number
  servers: {
    id: string
    name: string
  }[]
}[]
export type ListCatalogCategoriesApiArg = void
export type CreateCatalogCategoryApiResponse = /** status 201 The new category */ {
  id: string
  slug: string
  icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  names: {
    en: string
    pl: string
  }
  version: number
  productCount: number
  servers: {
    id: string
    name: string
  }[]
}
export type CreateCatalogCategoryApiArg = {
  body: {
    /** URL segment: 1–40 of a–z, 0–9 and "-". Also stored in shoppers’ cart cookies. */
    slug: string
    names: {
      en: string
      pl: string
    }
    /** Drawn on every product tile of the category */
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  }
}
export type UpdateCatalogCategoryApiResponse = /** status 200 The updated category */ {
  id: string
  slug: string
  icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  names: {
    en: string
    pl: string
  }
  version: number
  productCount: number
  servers: {
    id: string
    name: string
  }[]
}
export type UpdateCatalogCategoryApiArg = {
  id: string
  body: {
    /** URL segment: 1–40 of a–z, 0–9 and "-". Also stored in shoppers’ cart cookies. */
    slug: string
    names: {
      en: string
      pl: string
    }
    /** Drawn on every product tile of the category */
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
    /** The version you read. If someone saved since, the write fails with 409 `stale`. */
    version: number
  }
}
export type DeleteCatalogCategoryApiResponse = unknown
export type DeleteCatalogCategoryApiArg = {
  id: string
  version: string
}
export type ListCatalogProductsApiResponse = /** status 200 Products */ {
  id: string
  version: number
  sort: number
  serverId: string
  categoryId: string
  slug: string
  kind: 'PERMANENT' | 'TIMED' | 'CASE'
  mark: string
  /** The category's icon */
  icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  /** English name, or the slug while there is none */
  name: string
  isActive: boolean
  prices: {
    EUR: number | null
    PLN: number | null
  }
  /** What the product lacks before it may be enabled */
  missing: ('price.EUR' | 'price.PLN' | 'translation.en' | 'translation.pl')[]
}[]
export type ListCatalogProductsApiArg = {
  serverId?: string
  categoryId?: string
}
export type CreateCatalogProductApiResponse = /** status 201 The new product */ {
  id: string
  version: number
  sort: number
  serverId: string
  categoryId: string
  slug: string
  kind: 'PERMANENT' | 'TIMED' | 'CASE'
  durationDays: number | null
  mark: string
  isActive: boolean
  grantCommands: string[]
  revokeCommands: string[]
  prices: {
    EUR: number | null
    PLN: number | null
  }
  translations: {
    en: {
      name: string
      description: string
      sections: {
        title: string
        entries: {
          cmd?: string
          text?: string
          cooldown?: string
        }[]
      }[]
    } | null
    pl: {
      name: string
      description: string
      sections: {
        title: string
        entries: {
          cmd?: string
          text?: string
          cooldown?: string
        }[]
      }[]
    } | null
  }
  /** What the product lacks before it may be enabled */
  missing: ('price.EUR' | 'price.PLN' | 'translation.en' | 'translation.pl')[]
}
export type CreateCatalogProductApiArg = {
  body: {
    serverId: string
    /** Must be attached to the server */
    categoryId: string
    /** URL segment: 1–40 of a–z, 0–9 and "-". Also stored in shoppers’ cart cookies. */
    slug: string
    kind: 'PERMANENT' | 'TIMED' | 'CASE'
    /** Days until revoke commands run; required for TIMED, null otherwise */
    durationDays: number | null
    /** Short wordmark on the product tile */
    mark: string
    /** Run on the game server after payment */
    grantCommands: string[]
    /** Run when a TIMED product expires */
    revokeCommands: string[]
    prices: {
      EUR: number | null
      PLN: number | null
    }
    translations: {
      en: {
        name: string
        description: string
        sections: {
          title: string
          entries: {
            cmd?: string
            text?: string
            cooldown?: string
          }[]
        }[]
      } | null
      pl: {
        name: string
        description: string
        sections: {
          title: string
          entries: {
            cmd?: string
            text?: string
            cooldown?: string
          }[]
        }[]
      } | null
    }
  }
}
export type GetCatalogProductApiResponse = /** status 200 The product */ {
  id: string
  version: number
  sort: number
  serverId: string
  categoryId: string
  slug: string
  kind: 'PERMANENT' | 'TIMED' | 'CASE'
  durationDays: number | null
  mark: string
  isActive: boolean
  grantCommands: string[]
  revokeCommands: string[]
  prices: {
    EUR: number | null
    PLN: number | null
  }
  translations: {
    en: {
      name: string
      description: string
      sections: {
        title: string
        entries: {
          cmd?: string
          text?: string
          cooldown?: string
        }[]
      }[]
    } | null
    pl: {
      name: string
      description: string
      sections: {
        title: string
        entries: {
          cmd?: string
          text?: string
          cooldown?: string
        }[]
      }[]
    } | null
  }
  /** What the product lacks before it may be enabled */
  missing: ('price.EUR' | 'price.PLN' | 'translation.en' | 'translation.pl')[]
}
export type GetCatalogProductApiArg = {
  id: string
}
export type UpdateCatalogProductApiResponse = /** status 200 The updated product */ {
  id: string
  version: number
  sort: number
  serverId: string
  categoryId: string
  slug: string
  kind: 'PERMANENT' | 'TIMED' | 'CASE'
  durationDays: number | null
  mark: string
  isActive: boolean
  grantCommands: string[]
  revokeCommands: string[]
  prices: {
    EUR: number | null
    PLN: number | null
  }
  translations: {
    en: {
      name: string
      description: string
      sections: {
        title: string
        entries: {
          cmd?: string
          text?: string
          cooldown?: string
        }[]
      }[]
    } | null
    pl: {
      name: string
      description: string
      sections: {
        title: string
        entries: {
          cmd?: string
          text?: string
          cooldown?: string
        }[]
      }[]
    } | null
  }
  /** What the product lacks before it may be enabled */
  missing: ('price.EUR' | 'price.PLN' | 'translation.en' | 'translation.pl')[]
}
export type UpdateCatalogProductApiArg = {
  id: string
  body: {
    serverId: string
    /** Must be attached to the server */
    categoryId: string
    /** URL segment: 1–40 of a–z, 0–9 and "-". Also stored in shoppers’ cart cookies. */
    slug: string
    kind: 'PERMANENT' | 'TIMED' | 'CASE'
    /** Days until revoke commands run; required for TIMED, null otherwise */
    durationDays: number | null
    /** Short wordmark on the product tile */
    mark: string
    /** Run on the game server after payment */
    grantCommands: string[]
    /** Run when a TIMED product expires */
    revokeCommands: string[]
    prices: {
      EUR: number | null
      PLN: number | null
    }
    translations: {
      en: {
        name: string
        description: string
        sections: {
          title: string
          entries: {
            cmd?: string
            text?: string
            cooldown?: string
          }[]
        }[]
      } | null
      pl: {
        name: string
        description: string
        sections: {
          title: string
          entries: {
            cmd?: string
            text?: string
            cooldown?: string
          }[]
        }[]
      } | null
    }
    /** Shown on the storefront; needs both prices and both translations */
    isActive: boolean
    /** The version you read. If someone saved since, the write fails with 409 `stale`. */
    version: number
  }
}
export type DeleteCatalogProductApiResponse = unknown
export type DeleteCatalogProductApiArg = {
  id: string
  version: string
}
export type OrderCatalogProductsApiResponse = /** status 200 The list in its new order */ {
  id: string
  version: number
  sort: number
  serverId: string
  categoryId: string
  slug: string
  kind: 'PERMANENT' | 'TIMED' | 'CASE'
  mark: string
  /** The category's icon */
  icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
  /** English name, or the slug while there is none */
  name: string
  isActive: boolean
  prices: {
    EUR: number | null
    PLN: number | null
  }
  /** What the product lacks before it may be enabled */
  missing: ('price.EUR' | 'price.PLN' | 'translation.en' | 'translation.pl')[]
}[]
export type OrderCatalogProductsApiArg = {
  serverId: string
  categoryId: string
  body: {
    /** Every id of the list, in the new order. A different set of ids is 409 `stale`. */
    ids: string[]
    /** The order the client saw and moved from. If the current order differs, the reorder is 409 `stale`. */
    base: string[]
  }
}
export type GetRulesDraftApiResponse = /** status 200 The draft */ {
  content: {
    sections: {
      /** Stable id: 1–60 of a–z, 0–9 and "-" */
      id: string
      title: {
        /** English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \ escapes * + [ ] ( ) */
        en: string
        /** Polish text; the English text is shown when empty */
        pl?: string
      }
      items: {
        /** Stable id: 1–60 of a–z, 0–9 and "-" */
        id: string
        text: {
          /** English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \ escapes * + [ ] ( ) */
          en: string
          /** Polish text; the English text is shown when empty */
          pl?: string
        }
      }[]
    }[]
  }
  revision: number
  updatedAt: string
  updatedBy: string
}
export type GetRulesDraftApiArg = void
export type SaveRulesDraftApiResponse = /** status 200 The saved draft with its new revision */ {
  content: {
    sections: {
      /** Stable id: 1–60 of a–z, 0–9 and "-" */
      id: string
      title: {
        /** English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \ escapes * + [ ] ( ) */
        en: string
        /** Polish text; the English text is shown when empty */
        pl?: string
      }
      items: {
        /** Stable id: 1–60 of a–z, 0–9 and "-" */
        id: string
        text: {
          /** English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \ escapes * + [ ] ( ) */
          en: string
          /** Polish text; the English text is shown when empty */
          pl?: string
        }
      }[]
    }[]
  }
  revision: number
  updatedAt: string
  updatedBy: string
}
export type SaveRulesDraftApiArg = {
  body: {
    content: {
      sections: {
        /** Stable id: 1–60 of a–z, 0–9 and "-" */
        id: string
        title: {
          /** English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \ escapes * + [ ] ( ) */
          en: string
          /** Polish text; the English text is shown when empty */
          pl?: string
        }
        items: {
          /** Stable id: 1–60 of a–z, 0–9 and "-" */
          id: string
          text: {
            /** English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \ escapes * + [ ] ( ) */
            en: string
            /** Polish text; the English text is shown when empty */
            pl?: string
          }
        }[]
      }[]
    }
    /** The draft revision this edit was made from */
    revision: number
  }
}
export type PublishRulesApiResponse = /** status 201 The new version */ {
  id: number
  publishedAt: string
}
export type PublishRulesApiArg = {
  body: {
    /** The draft revision being published; 409 `stale` if someone saved since */
    revision: number
  }
}
export type ListRulesVersionsApiResponse = /** status 200 A page of editions */ {
  versions: {
    id: number
    publishedAt: string
    publishedBy: string
  }[]
  nextCursor: number | null
}
export type ListRulesVersionsApiArg = {
  cursor?: string
}
export type RestoreRulesVersionApiResponse = /** status 201 The draft after the restore */ {
  content: {
    sections: {
      /** Stable id: 1–60 of a–z, 0–9 and "-" */
      id: string
      title: {
        /** English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \ escapes * + [ ] ( ) */
        en: string
        /** Polish text; the English text is shown when empty */
        pl?: string
      }
      items: {
        /** Stable id: 1–60 of a–z, 0–9 and "-" */
        id: string
        text: {
          /** English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \ escapes * + [ ] ( ) */
          en: string
          /** Polish text; the English text is shown when empty */
          pl?: string
        }
      }[]
    }[]
  }
  revision: number
  updatedAt: string
  updatedBy: string
}
export type RestoreRulesVersionApiArg = {
  id: string
}
export type ListContentMessagesApiResponse = /** status 200 Messages */ {
  key: string
  namespace: string
  /** Built-in text */
  default: string
  /** Edited text, null when not overridden */
  override: string | null
  /** The override no longer has the placeholders or tags of the default (changed by a deploy); the site shows the default until it is fixed */
  stale: boolean
}[]
export type ListContentMessagesApiArg = {
  locale: 'en' | 'pl'
}
export type SetContentMessageApiResponse = /** status 200 The message with its new text */ {
  key: string
  namespace: string
  /** Built-in text */
  default: string
  /** Edited text, null when not overridden */
  override: string | null
  /** The override no longer has the placeholders or tags of the default (changed by a deploy); the site shows the default until it is fixed */
  stale: boolean
}
export type SetContentMessageApiArg = {
  locale: string
  key: string
  body: {
    /** Replacement text, 1–2000 chars after trimming */
    value: string
  }
}
export type ResetContentMessageApiResponse = unknown
export type ResetContentMessageApiArg = {
  locale: string
  key: string
}
export type GetContentSettingsApiResponse = /** status 200 Settings */ {
  siteName: {
    /** Plain part of the site name */
    plain: string
    /** Accent-coloured part of the site name */
    accent: string
  }
  /** Minecraft server address shown to players, optionally with :port */
  serverIp: string
  /** Discord invite link (https://) */
  discordUrl: string
  /** Support contact address */
  supportEmail: string
  /** Row version for optimistic locking */
  version: number
}
export type GetContentSettingsApiArg = void
export type UpdateContentSettingsApiResponse = /** status 200 The saved settings */ {
  siteName: {
    /** Plain part of the site name */
    plain: string
    /** Accent-coloured part of the site name */
    accent: string
  }
  /** Minecraft server address shown to players, optionally with :port */
  serverIp: string
  /** Discord invite link (https://) */
  discordUrl: string
  /** Support contact address */
  supportEmail: string
  /** Row version for optimistic locking */
  version: number
}
export type UpdateContentSettingsApiArg = {
  body: {
    siteName: {
      /** Plain part of the site name */
      plain: string
      /** Accent-coloured part of the site name */
      accent: string
    }
    /** Minecraft server address shown to players, optionally with :port */
    serverIp: string
    /** Discord invite link (https://) */
    discordUrl: string
    /** Support contact address */
    supportEmail: string
    /** Row version for optimistic locking */
    version: number
  }
}
export type ListAdminOrdersApiResponse = /** status 200 A page of orders */ {
  orders: {
    id: string
    publicId: string
    createdAt: string
    nick: string
    email: string
    currency: 'EUR' | 'PLN'
    totalMinor: number
    status: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED' | 'DISPUTED'
  }[]
  nextCursor: string | null
}
export type ListAdminOrdersApiArg = {
  q?: string
  status?: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED' | 'DISPUTED'
  cursor?: string
}
export type GetAdminOrderApiResponse = /** status 200 The order */ {
  publicId: string
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED' | 'DISPUTED'
  nick: string
  email: string
  currency: 'EUR' | 'PLN'
  totalMinor: number
  servers: {
    serverName: string
    items: {
      productName: string
      quantity: number
      unitAmountMinor: number
    }[]
  }[]
  createdAt: string
  paidAt: string | null
  id: string
  locale: 'en' | 'pl'
  stripeSessionId: string | null
  deliveryConsentAt: string
  subtotalMinor: number
  discountMinor: number
}
export type GetAdminOrderApiArg = {
  id: string
}
export type GetOrderStatsApiResponse = /** status 200 Statistics for the range */ {
  range: '7d' | '30d'
  currency: 'EUR' | 'PLN'
  from: string
  to: string
  revenueMinor: number
  previousRevenueMinor: number
  paidCount: number
  previousPaidCount: number
  averageMinor: number | null
  ltvMinor: number | null
  buyers: number
  awaitingRate: number
  previousAwaitingRate: number
  expiredCount: number
  conversion: number | null
  byStatus: {
    status: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED' | 'DISPUTED'
    count: number
  }[]
  byCurrency: {
    currency: 'EUR' | 'PLN'
    count: number
    totalMinor: number
  }[]
  daily: {
    day: string
    totalMinor: number
    paidCount: number
  }[]
  topProducts: {
    productId: string
    name: string
    serverName: string
    quantity: number
  }[]
}
export type GetOrderStatsApiArg = {
  range?: '7d' | '30d'
  currency?: 'EUR' | 'PLN'
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
  useGetApiAdminAuditQuery,
  useListCatalogServersQuery,
  useCreateCatalogServerMutation,
  useOrderCatalogServersMutation,
  useGetCatalogServerQuery,
  useUpdateCatalogServerMutation,
  useDeleteCatalogServerMutation,
  useSetCatalogServerCategoriesMutation,
  useUpdateCatalogServerRconMutation,
  useTestCatalogServerRconMutation,
  useListCatalogCategoriesQuery,
  useCreateCatalogCategoryMutation,
  useUpdateCatalogCategoryMutation,
  useDeleteCatalogCategoryMutation,
  useListCatalogProductsQuery,
  useCreateCatalogProductMutation,
  useGetCatalogProductQuery,
  useUpdateCatalogProductMutation,
  useDeleteCatalogProductMutation,
  useOrderCatalogProductsMutation,
  useGetRulesDraftQuery,
  useSaveRulesDraftMutation,
  usePublishRulesMutation,
  useListRulesVersionsQuery,
  useRestoreRulesVersionMutation,
  useListContentMessagesQuery,
  useSetContentMessageMutation,
  useResetContentMessageMutation,
  useGetContentSettingsQuery,
  useUpdateContentSettingsMutation,
  useListAdminOrdersQuery,
  useGetAdminOrderQuery,
  useGetOrderStatsQuery
} = injectedRtkApi
