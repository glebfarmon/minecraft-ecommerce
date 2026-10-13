import type Redis from 'ioredis'

import {RATE_LIMIT_DEFAULTS, type RateLimits} from '../throttle/rate-limits'

type Counter = Pick<Redis, 'incr' | 'expire'>

async function under(redis: Counter, key: string, max: number, ttlS: number) {
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, ttlS)
  return n <= max
}

/** Send-OTP limits from parent spec §7.5 (per email / 10 min, per IP / hour). Fails closed: no Redis, no code. */
export async function otpAllowed(
  redis: Counter,
  email: string,
  ip: string,
  limits: Pick<RateLimits, 'otpPerEmail' | 'otpPerIp'> = RATE_LIMIT_DEFAULTS
): Promise<boolean> {
  try {
    const byEmail = await under(redis, `otp:email:${email.toLowerCase()}`, limits.otpPerEmail, 600)
    const byIp = await under(redis, `otp:ip:${ip}`, limits.otpPerIp, 3600)
    return byEmail && byIp
  } catch {
    return false
  }
}

/**
 * TOTP and backup-code checks per subject per minute (`user:<id>` with a session, the hashed
 * two-factor cookie or the proxy-set IP otherwise). Better Auth has no per-session limit here.
 * Fails closed.
 */
export async function secondFactorAllowed(
  redis: Counter,
  subject: string,
  max: number = RATE_LIMIT_DEFAULTS.secondFactor
): Promise<boolean> {
  try {
    return await under(redis, `2fa:${subject}`, max, 60)
  } catch {
    return false
  }
}
