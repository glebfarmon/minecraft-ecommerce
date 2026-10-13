import {otpAllowed, secondFactorAllowed} from './otp-limit'

function fakeRedis() {
  const counts = new Map<string, number>()
  return {
    incr: jest.fn((k: string) => {
      counts.set(k, (counts.get(k) ?? 0) + 1)
      return Promise.resolve(counts.get(k))
    }),
    expire: jest.fn(() => Promise.resolve(1))
  }
}

describe('otpAllowed', () => {
  it('allows 3 codes per email in 10 minutes', async () => {
    const redis = fakeRedis()
    const results = []
    for (let i = 0; i < 4; i++) results.push(await otpAllowed(redis as never, 'a@x.io', '1.1.1.1'))
    expect(results).toEqual([true, true, true, false])
    expect(redis.expire).toHaveBeenCalledWith('otp:email:a@x.io', 600)
  })

  it('allows 10 per IP per hour across emails', async () => {
    const redis = fakeRedis()
    const results = []
    for (let i = 0; i < 11; i++)
      results.push(await otpAllowed(redis as never, `u${String(i)}@x.io`, '2.2.2.2'))
    expect(results.at(-1)).toBe(false)
    expect(results.slice(0, 10).every(Boolean)).toBe(true)
  })

  it('fails closed when Redis is down', async () => {
    const down = {incr: () => Promise.reject(new Error('down')), expire: () => Promise.resolve(0)}
    expect(await otpAllowed(down as never, 'a@x.io', '1.1.1.1')).toBe(false)
  })
})

describe('secondFactorAllowed', () => {
  it('allows 5 checks per minute per subject, then refuses', async () => {
    const redis = fakeRedis()
    const results = []
    for (let i = 0; i < 6; i++) results.push(await secondFactorAllowed(redis as never, 'user:u1'))
    expect(results).toEqual([true, true, true, true, true, false])
    expect(redis.expire).toHaveBeenCalledWith('2fa:user:u1', 60)
    expect(await secondFactorAllowed(redis as never, 'user:u2')).toBe(true)
  })

  it('fails closed when Redis is down', async () => {
    const down = {incr: () => Promise.reject(new Error('down')), expire: () => Promise.resolve(0)}
    expect(await secondFactorAllowed(down as never, 'user:u1')).toBe(false)
  })
})

describe('configurable budgets', () => {
  it('uses the limits it is given', async () => {
    const redis = fakeRedis()
    const limits = {otpPerEmail: 1, otpPerIp: 10}
    expect(await otpAllowed(redis as never, 'b@x.io', '3.3.3.3', limits)).toBe(true)
    expect(await otpAllowed(redis as never, 'b@x.io', '3.3.3.3', limits)).toBe(false)
    expect(await secondFactorAllowed(redis as never, 'user:u3', 1)).toBe(true)
    expect(await secondFactorAllowed(redis as never, 'user:u3', 1)).toBe(false)
  })
})
