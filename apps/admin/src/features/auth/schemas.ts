import * as v from 'valibot'

export const EmailSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email('Enter a valid email'))
})
export const CodeSchema = v.object({
  code: v.pipe(v.string(), v.trim(), v.regex(/^\d{6}$/, 'Enter the 6 digits'))
})
export const BackupSchema = v.object({
  code: v.pipe(v.string(), v.trim(), v.minLength(6, 'Enter a backup code'))
})
