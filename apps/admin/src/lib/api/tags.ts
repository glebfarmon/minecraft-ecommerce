import {api} from './generated'

/**
 * Cache tags for list refresh after mutations. Kept out of generated.ts so codegen can overwrite
 * that file; `store.ts` imports this module, so the tags are in place before any hook runs.
 */
type Tag =
  | 'Admins'
  | 'Invites'
  | 'Roles'
  | 'Audit'
  | 'CatalogServers'
  | 'CatalogCategories'
  | 'CatalogProducts'
  | 'RulesDraft'
  | 'RulesVersions'
  | 'ContentMessages'
  | 'ContentSettings'

/**
 * Invalidate only when the mutation succeeded. A rejected update (409 stale) must not refetch:
 * the refetch would hand the editor the other admin's version, and the next Save would
 * silently overwrite their change.
 */
const onSuccess =
  (tags: Tag[]) =>
  (_result: unknown, error: unknown): Tag[] =>
    error ? [] : tags

export const enhancedApi = api.enhanceEndpoints({
  addTagTypes: [
    'Admins',
    'Invites',
    'Roles',
    'Audit',
    'CatalogServers',
    'CatalogCategories',
    'CatalogProducts',
    'RulesDraft',
    'RulesVersions',
    'ContentMessages',
    'ContentSettings'
  ],
  endpoints: {
    getApiAdminAdmins: {providesTags: ['Admins']},
    deleteApiAdminAdminsById: {invalidatesTags: ['Admins', 'Audit']},
    patchApiAdminAdminsByIdRole: {invalidatesTags: ['Admins', 'Audit']},
    postApiAdminAdminsByIdReset2Fa: {invalidatesTags: ['Admins', 'Audit']},
    getApiAdminInvites: {providesTags: ['Invites']},
    postApiAdminInvites: {invalidatesTags: ['Invites', 'Audit']},
    deleteApiAdminInvitesById: {invalidatesTags: ['Invites', 'Audit']},
    postApiAdminInvitesByIdResend: {invalidatesTags: ['Invites', 'Audit']},
    getApiAdminRoles: {providesTags: ['Roles']},
    postApiAdminRoles: {invalidatesTags: ['Roles', 'Audit']},
    patchApiAdminRolesById: {invalidatesTags: ['Roles', 'Admins', 'Audit']},
    deleteApiAdminRolesById: {invalidatesTags: ['Roles', 'Audit']},
    getApiAdminAudit: {providesTags: ['Audit']},
    listCatalogServers: {providesTags: ['CatalogServers']},
    getCatalogServer: {providesTags: ['CatalogServers']},
    createCatalogServer: {invalidatesTags: ['CatalogServers', 'Audit']},
    updateCatalogServer: {invalidatesTags: onSuccess(['CatalogServers', 'Audit'])},
    deleteCatalogServer: {invalidatesTags: ['CatalogServers', 'CatalogCategories', 'Audit']},
    orderCatalogServers: {invalidatesTags: ['CatalogServers', 'Audit']},
    setCatalogServerCategories: {invalidatesTags: ['CatalogServers', 'CatalogCategories', 'Audit']},
    updateCatalogServerRcon: {invalidatesTags: ['CatalogServers', 'Audit']},
    testCatalogServerRcon: {invalidatesTags: ['Audit']},
    listCatalogCategories: {providesTags: ['CatalogCategories']},
    createCatalogCategory: {invalidatesTags: ['CatalogCategories', 'Audit']},
    updateCatalogCategory: {
      invalidatesTags: onSuccess(['CatalogCategories', 'CatalogServers', 'Audit'])
    },
    deleteCatalogCategory: {invalidatesTags: ['CatalogCategories', 'Audit']},
    listCatalogProducts: {providesTags: ['CatalogProducts']},
    getCatalogProduct: {providesTags: ['CatalogProducts']},
    createCatalogProduct: {
      invalidatesTags: ['CatalogProducts', 'CatalogServers', 'CatalogCategories', 'Audit']
    },
    updateCatalogProduct: {
      invalidatesTags: onSuccess([
        'CatalogProducts',
        'CatalogServers',
        'CatalogCategories',
        'Audit'
      ])
    },
    deleteCatalogProduct: {
      invalidatesTags: ['CatalogProducts', 'CatalogServers', 'CatalogCategories', 'Audit']
    },
    orderCatalogProducts: {invalidatesTags: ['CatalogProducts', 'Audit']},
    getRulesDraft: {providesTags: ['RulesDraft']},
    saveRulesDraft: {invalidatesTags: onSuccess(['RulesDraft', 'Audit'])},
    publishRules: {invalidatesTags: ['RulesVersions', 'Audit']},
    listRulesVersions: {providesTags: ['RulesVersions']},
    restoreRulesVersion: {invalidatesTags: onSuccess(['RulesDraft', 'Audit'])},
    listContentMessages: {providesTags: ['ContentMessages']},
    setContentMessage: {invalidatesTags: onSuccess(['ContentMessages', 'Audit'])},
    resetContentMessage: {invalidatesTags: ['ContentMessages', 'Audit']},
    getContentSettings: {providesTags: ['ContentSettings']},
    updateContentSettings: {invalidatesTags: onSuccess(['ContentSettings', 'Audit'])}
  }
})
