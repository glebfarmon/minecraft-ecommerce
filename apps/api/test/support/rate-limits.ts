/**
 * Suites that are not about rate limits sign the same people in many times; with the spec limits
 * the fourth sign-in code for an email is silently not sent. Call before `createApp()`: the limits
 * are read when the app (and Better Auth) is created. `rate-limit.int-spec.ts` keeps the real values.
 */
export function relaxRateLimits(): void {
  for (const name of [
    'RATE_LIMIT_OTP_EMAIL',
    'RATE_LIMIT_OTP_IP',
    'RATE_LIMIT_SECOND_FACTOR',
    'RATE_LIMIT_2FA_DAY',
    'RATE_LIMIT_ADMIN',
    'RATE_LIMIT_ADMIN_IP',
    'RATE_LIMIT_DEFAULT'
  ])
    process.env[name] = '10000'
}
