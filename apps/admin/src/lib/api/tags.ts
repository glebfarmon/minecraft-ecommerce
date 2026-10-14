import {api} from './generated'

/**
 * Cache tags for list refresh after mutations. Kept out of generated.ts so codegen can overwrite
 * that file; `store.ts` imports this module, so the tags are in place before any hook runs.
 */
export const enhancedApi = api.enhanceEndpoints({
  addTagTypes: ['Admins', 'Invites', 'Roles', 'Audit'],
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
    getApiAdminAudit: {providesTags: ['Audit']}
  }
})
