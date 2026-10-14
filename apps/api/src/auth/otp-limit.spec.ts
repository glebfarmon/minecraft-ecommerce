import {
  claimTotp,
  hit,
  otpAllowed,
  releaseTotp,
  secondFactorAllowed,
  secondFactorDayAllowed
} from './otp-limit'

/** Mirrors the counter script: INCR, then give the key a TTL whenever it has none. */
function fakeRedis() {
  const counts = new Map<string, number>()
  const ttls = new Map<string, number>()
  return {
    ttls,
    eval: jest.fn((_script: string, _keys: number, key: string, ttlS: number) => {
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (!ttls.has(key)) ttls.set(key, ttlS)
      return Promise.resolve([counts.get(key), ttls.get(key)])
    })
  }
}

describe('otpAllowed', () => {
  it('allows 3 codes per email in 10 minutes', async () => {
    const redis = fakeRedis()
    const results = []
    for (let i = 0; i < 4; i++) results.push(await otpAllowed(redis as never, 'a@x.io', '1.1.1.1'))
    expect(results).toEqual([true, true, true, false])
    expect(redis.ttls.get('otp:email:a@x.io')).toBe(600)
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
    const down = {eval: () => Promise.reject(new Error('down'))}
    expect(await otpAllowed(down as never, 'a@x.io', '1.1.1.1')).toBe(false)
  })
})

describe('secondFactorAllowed', () => {
  it('allows 5 checks per minute per subject, then refuses', async () => {
    const redis = fakeRedis()
    const results = []
    for (let i = 0; i < 6; i++) results.push(await secondFactorAllowed(redis as never, 'user:u1'))
    expect(results).toEqual([true, true, true, true, true, false])
    expect(redis.ttls.get('2fa:user:u1')).toBe(60)
    expect(await secondFactorAllowed(redis as never, 'user:u2')).toBe(true)
  })

  it('fails closed when Redis is down', async () => {
    const down = {eval: () => Promise.reject(new Error('down'))}
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

describe('hit', () => {
  it('counts and sets the TTL in one atomic script that also repairs a key without TTL', async () => {
    const redis = fakeRedis()
    expect(await hit(redis as never, 'k', 600)).toEqual({count: 1, ttlS: 600})
    const [script, keys, key, ttl] = redis.eval.mock.calls[0] ?? []
    expect([keys, key, ttl]).toEqual([1, 'k', 600])
    expect(script).toMatch(/INCR/)
    expect(script).toMatch(/TTL/)
    expect(script).toMatch(/EXPIRE/)
  })
})

describe('secondFactorDayAllowed', () => {
  it('allows 30 checks per day per subject, then refuses', async () => {
    const redis = fakeRedis()
    const results = []
    for (let i = 0; i < 31; i++)
      results.push(await secondFactorDayAllowed(redis as never, 'user:u1'))
    expect(results.slice(0, 30).every(Boolean)).toBe(true)
    expect(results.at(-1)).toBe(false)
    expect(redis.ttls.get('2fa:day:user:u1')).toBe(86_400)
    expect(await secondFactorDayAllowed(redis as never, 'user:u2')).toBe(true)
  })

  it('uses the budget it is given', async () => {
    const redis = fakeRedis()
    expect(await secondFactorDayAllowed(redis as never, 'user:u1', 1)).toBe(true)
    expect(await secondFactorDayAllowed(redis as never, 'user:u1', 1)).toBe(false)
  })

  it('fails closed when Redis is down', async () => {
    const down = {eval: () => Promise.reject(new Error('down'))}
    expect(await secondFactorDayAllowed(down as never, 'user:u1')).toBe(false)
  })
})

/** A key-value store with the calls the replay guard makes (SET key value EX ttl NX, DEL). */
function fakeStore() {
  const keys = new Map<string, {value: string; ttlS: number}>()
  return {
    keys,
    del: jest.fn((key: string) => Promise.resolve(keys.delete(key) ? 1 : 0)),
    set: jest.fn((key: string, value: string, _ex: 'EX', ttlS: number, mode?: 'NX') => {
      if (mode === 'NX' && keys.has(key)) return Promise.resolve(null)
      keys.set(key, {value, ttlS})
      return Promise.resolve('OK')
    })
  }
}

describe('claimTotp (replay guard)', () => {
  it('lets a code through once per user for the whole ±1 step window (90 s)', async () => {
    const redis = fakeStore()
    expect(await claimTotp(redis as never, 'u1', '123456')).toBe(true)
    expect(redis.keys.get('totp:used:u1:123456')).toEqual({value: '1', ttlS: 90})
    expect(redis.set).toHaveBeenCalledWith('totp:used:u1:123456', '1', 'EX', 90, 'NX')
    expect(await claimTotp(redis as never, 'u1', '123456')).toBe(false)
    // Another code, or the same code for someone else, is not a replay.
    expect(await claimTotp(redis as never, 'u1', '654321')).toBe(true)
    expect(await claimTotp(redis as never, 'u2', '123456')).toBe(true)
  })

  it('gives a claimed code back when it did not pass (a wrong code stays a plain 401)', async () => {
    const redis = fakeStore()
    expect(await claimTotp(redis as never, 'u1', '123456')).toBe(true)
    await releaseTotp(redis as never, 'u1', '123456')
    expect(redis.keys.has('totp:used:u1:123456')).toBe(false)
    expect(await claimTotp(redis as never, 'u1', '123456')).toBe(true)
  })

  it('fails closed when Redis is down', async () => {
    const down = {set: () => Promise.reject(new Error('down'))}
    expect(await claimTotp(down as never, 'u1', '123456')).toBe(false)
  })
})
