import type Redis from 'ioredis'

import {RATE_LIMIT_DEFAULTS, type RateLimits} from '../throttle/rate-limits'

type Counter = Pick<Redis, 'eval'>

/**
 * INCR and the expiry in one atomic script. It also gives a key without TTL one (left behind by a
 * crash or an older build): since the limiters fail closed, a counter that never expires would lock
 * that email, IP or user out for good.
 */
const HIT_SCRIPT = `local n = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {n, ttl}`

/** One hit on a fixed-window counter: the count so far and the seconds left in the window. */
export async function hit(
  redis: Counter,
  key: string,
  ttlS: number
): Promise<{count: number; ttlS: number}> {
  const [count, left] = (await redis.eval(HIT_SCRIPT, 1, key, ttlS)) as [number, number]
  return {count, ttlS: left}
}

async function under(redis: Counter, key: string, max: number, ttlS: number) {
  return (await hit(redis, key, ttlS)).count <= max
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
