import * as v from 'valibot'

export const InviteFormSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email('Enter a valid email'))
})
export type InviteForm = v.InferOutput<typeof InviteFormSchema>

export const RoleNameSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(2, 'Use 2 to 40 characters'),
    v.maxLength(40, 'Use 2 to 40 characters')
  )
})
export type RoleNameForm = v.InferOutput<typeof RoleNameSchema>
