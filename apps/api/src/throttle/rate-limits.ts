/** Requests allowed per window; windows are fixed (send OTP: 10 min per email, 1 h per IP; others 1 min). */
export type RateLimits = {
  /** Sign-in codes mailed per email per 10 minutes. */
  otpPerEmail: number
  /** Sign-in codes mailed per client IP per hour. */
  otpPerIp: number
  /** TOTP / backup-code checks per session (or user) per minute. */
  secondFactor: number
  /** Admin API requests per session per minute. */
  admin: number
  /** Every other throttled request per IP per minute. */
  default: number
}

/** Spec values (parent spec §7.5, admin-access spec). */
export const RATE_LIMIT_DEFAULTS: Readonly<RateLimits> = Object.freeze({
  otpPerEmail: 3,
  otpPerIp: 10,
  secondFactor: 5,
  admin: 300,
  default: 100
})

const ENV_NAMES = {
  otpPerEmail: 'RATE_LIMIT_OTP_EMAIL',
  otpPerIp: 'RATE_LIMIT_OTP_IP',
  secondFactor: 'RATE_LIMIT_SECOND_FACTOR',
  admin: 'RATE_LIMIT_ADMIN',
  default: 'RATE_LIMIT_DEFAULT'
} as const satisfies Record<keyof RateLimits, string>

/**
 * The limits, overridable through `RATE_LIMIT_*` env vars (tests raise them; production keeps the
 * defaults). A malformed value stops the app instead of silently dropping a limit.
 */
export function rateLimits(env: Partial<Record<string, string>> = process.env): RateLimits {
  const limits = {...RATE_LIMIT_DEFAULTS}
  for (const key of Object.keys(ENV_NAMES) as (keyof RateLimits)[]) {
    const name = ENV_NAMES[key]
    const raw = env[name]
    if (raw === undefined || raw === '') continue
    if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer, got "${raw}"`)
    limits[key] = Number(raw)
  }
  return limits
}
