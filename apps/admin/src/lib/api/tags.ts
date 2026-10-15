import {api} from './generated'

/**
 * Cache tags for list refresh after mutations. Kept out of generated.ts so codegen can overwrite
 * that file; `store.ts` imports this module, so the tags are in place before any hook runs.
 */
export const enhancedApi = api.enhanceEndpoints({
  addTagTypes: [
    'Admins',
    'Invites',
    'Roles',
    'Audit',
    'CatalogServers',
    'CatalogCategories',
    'CatalogProducts'
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
    updateCatalogServer: {invalidatesTags: ['CatalogServers', 'Audit']},
    deleteCatalogServer: {invalidatesTags: ['CatalogServers', 'Audit']},
    orderCatalogServers: {invalidatesTags: ['CatalogServers', 'Audit']},
    setCatalogServerCategories: {invalidatesTags: ['CatalogServers', 'CatalogCategories', 'Audit']},
    updateCatalogServerRcon: {invalidatesTags: ['CatalogServers', 'Audit']},
    testCatalogServerRcon: {invalidatesTags: ['Audit']},
    listCatalogCategories: {providesTags: ['CatalogCategories']},
    createCatalogCategory: {invalidatesTags: ['CatalogCategories', 'Audit']},
    updateCatalogCategory: {invalidatesTags: ['CatalogCategories', 'CatalogServers', 'Audit']},
    deleteCatalogCategory: {invalidatesTags: ['CatalogCategories', 'Audit']},
    listCatalogProducts: {providesTags: ['CatalogProducts']},
    getCatalogProduct: {providesTags: ['CatalogProducts']},
    createCatalogProduct: {
      invalidatesTags: ['CatalogProducts', 'CatalogServers', 'CatalogCategories', 'Audit']
    },
    updateCatalogProduct: {
      invalidatesTags: ['CatalogProducts', 'CatalogServers', 'CatalogCategories', 'Audit']
    },
    deleteCatalogProduct: {
      invalidatesTags: ['CatalogProducts', 'CatalogServers', 'CatalogCategories', 'Audit']
    },
    orderCatalogProducts: {invalidatesTags: ['CatalogProducts', 'Audit']}
  }
})
