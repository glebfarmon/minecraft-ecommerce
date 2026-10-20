type AuthError = {status?: number; message?: string} | null | undefined

/** Maps a Better Auth error to the copy shown under a code field. */
/** `t` is the auth-namespace translator; `fallback` is already in the admin's language. */
export function codeErrorMessage(
  error: AuthError,
  fallback: string,
  t: (key: 'tooManyAttempts') => string
): string {
  if (error?.status === 429) return t('tooManyAttempts')
  return fallback
}
