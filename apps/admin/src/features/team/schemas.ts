import {FORM_MESSAGES} from '@/lib/validation-messages'
import * as v from 'valibot'

export const InviteFormSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email(FORM_MESSAGES.validEmail))
})
export type InviteForm = v.InferOutput<typeof InviteFormSchema>

export const RoleNameSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(2, FORM_MESSAGES.roleNameLength),
    v.maxLength(40, FORM_MESSAGES.roleNameLength)
  )
})
export type RoleNameForm = v.InferOutput<typeof RoleNameSchema>
