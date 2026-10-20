'use client'

import {type ApiErrorTranslate, apiErrorMessage} from '@/lib/api/error-message'
import {messageKey} from '@/lib/validation-messages'
import {useTranslations} from 'next-intl'

/** Shows a schema message in the admin's language: one of our known English texts is looked up by key. */
export function useErrorText() {
  const t = useTranslations('validation')
  return (message: string | undefined): string | undefined => {
    const key = message === undefined ? undefined : messageKey(message)
    // Keys come from the shared/admin message maps, which `messages.test.ts` keeps in step with the files.
    return key === undefined ? message : t(key as never)
  }
}

/** Turns an RTK Query error into a sentence in the admin's language. */
export function useApiError() {
  const t = useTranslations('apiErrors') as unknown as ApiErrorTranslate
  return (error: unknown) => apiErrorMessage(error, t)
}
