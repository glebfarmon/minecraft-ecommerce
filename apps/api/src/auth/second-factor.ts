/**
 * Spec decision #5: a session is "verified" only after proving a working authenticator in it.
 * Pure rules here; `auth.ts` maps them onto Better Auth hooks.
 */

const VERIFY_TOTP = '/two-factor/verify-totp'
const VERIFY_BACKUP_CODE = '/two-factor/verify-backup-code'

/**
 * 2FA settings that would let a session mint or replace its own second factor (backup codes, the
 * TOTP secret, disabling and re-enrolling). Once a user has a verified TOTP, only a session that
 * passed it may call them; during first enrollment they stay open. (`view-backup-codes` is
 * server-only in Better Auth 1.7, so it has no HTTP route to guard.)
 */
const SETTINGS_PATHS = new Set([
  '/two-factor/enable',
  '/two-factor/disable',
  '/two-factor/get-totp-uri',
  '/two-factor/generate-backup-codes'
])

export type GateSession = {
  user: {id: string; twoFactorEnabled?: boolean | null}
  session: {twoFactorVerifiedAt?: Date | null}
} | null
/** True when the user has a verified TOTP (a proven authenticator). */
export type IsEnrolled = (userId: string) => Promise<boolean>
export type GateDecision = 'ok' | 'unauthorized' | '2fa_required'

export async function secondFactorGate(
  path: string,
  readSession: () => Promise<GateSession>,
  isEnrolled: IsEnrolled
): Promise<GateDecision> {
  const isBackupCode = path === VERIFY_BACKUP_CODE
  if (!isBackupCode && !SETTINGS_PATHS.has(path)) return 'ok'
  // Fail closed: Better Auth's session lookup returns null on errors too, and the endpoint re-reads it.
  const current = await readSession()
  if (!current) return 'unauthorized'
  const enrolled = Boolean(current.user.twoFactorEnabled) || (await isEnrolled(current.user.id))
  // Enrollment hands out backup codes before the TOTP is proven: first enrollment must use verify-totp.
  if (isBackupCode) return enrolled ? 'ok' : '2fa_required'
  if (current.session.twoFactorVerifiedAt || !enrolled) return 'ok'
  return '2fa_required'
}

/** Whether a successful call to `path` marks the session as having passed the second factor. */
export async function shouldStamp(
  path: string,
  userId: string,
  isEnrolled: IsEnrolled
): Promise<boolean> {
  if (path === VERIFY_TOTP) return true
  if (path === VERIFY_BACKUP_CODE) return isEnrolled(userId)
  return false
}
