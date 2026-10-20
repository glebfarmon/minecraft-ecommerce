import {FORM_MESSAGES} from '@/lib/validation-messages'
import * as v from 'valibot'

import {VALIDATION_MESSAGES} from '@shop/shared/validation-messages'

export const EmailSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email(VALIDATION_MESSAGES.validEmail))
})
export const CodeSchema = v.object({
  code: v.pipe(v.string(), v.trim(), v.regex(/^\d{6}$/, FORM_MESSAGES.sixDigits))
})
export const BackupSchema = v.object({
  code: v.pipe(v.string(), v.trim(), v.minLength(6, FORM_MESSAGES.backupCode))
})
