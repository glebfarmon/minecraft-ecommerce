type AuthError = {status?: number; message?: string} | null | undefined

/** Maps a Better Auth error to the copy shown under a code field. */
export function codeErrorMessage(error: AuthError, fallback: string): string {
  if (error?.status === 429) return 'Too many attempts. Wait a minute and try again.'
  return fallback
}
