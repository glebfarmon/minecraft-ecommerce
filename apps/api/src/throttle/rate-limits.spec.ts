import {RATE_LIMIT_DEFAULTS, rateLimits} from './rate-limits'

describe('rateLimits', () => {
  it('defaults to the spec values', () => {
    expect(rateLimits({})).toEqual({
      otpPerEmail: 3,
      otpPerIp: 10,
      secondFactor: 5,
      admin: 300,
      adminIp: 600,
      default: 100
    })
    expect(rateLimits({})).toEqual(RATE_LIMIT_DEFAULTS)
  })

  it('reads overrides from the environment', () => {
    expect(
      rateLimits({
        RATE_LIMIT_OTP_EMAIL: '50',
        RATE_LIMIT_OTP_IP: '60',
        RATE_LIMIT_SECOND_FACTOR: '70',
        RATE_LIMIT_ADMIN: '80',
        RATE_LIMIT_ADMIN_IP: '85',
        RATE_LIMIT_DEFAULT: '90'
      })
    ).toEqual({
      otpPerEmail: 50,
      otpPerIp: 60,
      secondFactor: 70,
      admin: 80,
      adminIp: 85,
      default: 90
    })
  })

  it('treats an empty value as unset', () => {
    expect(rateLimits({RATE_LIMIT_ADMIN: ''}).admin).toBe(300)
  })

  it.each(['0', '-1', '1.5', 'many'])('refuses %p instead of silently dropping a limit', value => {
    expect(() => rateLimits({RATE_LIMIT_OTP_EMAIL: value})).toThrow(/RATE_LIMIT_OTP_EMAIL/)
  })
})
