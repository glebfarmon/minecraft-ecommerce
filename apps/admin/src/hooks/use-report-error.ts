'use client'

import {notify} from '@/components/toaster'
import {useApiError} from '@/hooks/use-error-text'

/** A 409: the data changed under the admin (stale version) or collides with other data (taken slug, in use). */
export const isConflict = (error: unknown) =>
  (error as {status?: unknown} | undefined)?.status === 409

/**
 * Reports a failed mutation. A conflict belongs next to the form or list it concerns, so it goes to
 * `inline`; every other refusal is transient and becomes an error toast, translated now.
 */
export function useReportError(inline: (message: string) => void) {
  const apiError = useApiError()
  return (error: unknown) => {
    const message = apiError(error)
    if (isConflict(error)) inline(message)
    else notify.error(message)
  }
}
