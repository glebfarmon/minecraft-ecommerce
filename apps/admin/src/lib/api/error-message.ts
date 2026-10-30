/** `t` bound to the `apiErrors` namespace (see `useApiError`). */
export type ApiErrorTranslate = (key: string, values?: Record<string, string | number>) => string

/** API error codes with a sentence of their own under `apiErrors.<code>`. */
const CODES = new Set([
  'owner_protected',
  'cannot_grant',
  'forbidden',
  'user_exists',
  'invite_closed',
  'role_in_use',
  'role_name_taken',
  'mail_failed',
  'unknown_role',
  'stale',
  'in_use',
  'incomplete',
  'slug_locked',
  'slug_taken',
  'category_not_on_server',
  'unknown_category',
  'rcon_host_private',
  'rcon_host_unresolvable',
  'rcon_not_configured',
  'rcon_key_missing',
  'not_published',
  'unknown_key',
  'invalid_locale',
  'promo_locked',
  'max_uses_below_used',
  'code_taken'
])

/** The entities an `in_use` answer counts; each has an ICU plural under `apiErrors.in_use_<entity>`. */
const COUNTED = new Set(['products', 'orders', 'servers', 'promoCodes'])

/** Turns an RTK Query error into the sentence shown to the admin, in the language `t` speaks. */
export function apiErrorMessage(error: unknown, t: ApiErrorTranslate): string {
  const e = error as
    {status?: unknown; data?: {message?: unknown; issues?: Record<string, unknown>}} | undefined
  const code = typeof e?.data?.message === 'string' ? e.data.message : undefined
  if (code === 'in_use' && e?.data?.issues) {
    const counts = Object.entries(e.data.issues)
      .filter(
        (entry): entry is [string, number] =>
          COUNTED.has(entry[0]) && typeof entry[1] === 'number' && entry[1] > 0
      )
      .map(([what, count]) => t(`in_use_${what}`, {count}))
    if (counts.length > 0) return t('in_use_counts', {list: counts.join(', ')})
  }
  if (code === 'placeholder_mismatch') {
    const expected = e?.data?.issues?.expected
    if (Array.isArray(expected) && expected.length > 0)
      return t('placeholder_mismatch_expected', {expected: expected.join(', ')})
    return t('placeholder_mismatch')
  }
  // ValibotPipe's message for a body that fails the shared schema.
  if (code === 'Validation failed') return t('validation_failed')
  if (code && CODES.has(code)) return t(code)
  if (e?.status === 404) return t('notFound')
  // The body parser answers 413 before the API sees the body; only the rules draft gets that big.
  if (e?.status === 413) return t('tooLarge')
  if (e?.status === 429) return t('tooMany')
  return t('generic')
}
