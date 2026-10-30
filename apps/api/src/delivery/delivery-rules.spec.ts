import {
  MAX_ATTEMPTS,
  type SendOutcome,
  decideNext,
  grantExpiry,
  publicDeliveryState,
  renderCommands,
  retryDelayMs
} from './delivery-rules'

const now = new Date('2026-01-01T00:00:00Z')
const DAY = 86_400_000

describe('renderCommands', () => {
  it('renders {nick} and repeats quantity times in order', () => {
    expect(renderCommands(['a {nick}', 'b {nick} {nick}'], 'Steve', 2)).toEqual([
      'a Steve',
      'b Steve Steve',
      'a Steve',
      'b Steve Steve'
    ])
  })

  it('renderCommands rejects a nick outside NICK_PATTERN', () => {
    for (const nick of ['x; op', 'ab', 'a\nb', 'a'.repeat(17)]) {
      expect(() => renderCommands(['x {nick}'], nick, 1)).toThrow('invalid_nick')
    }
  })
})

describe('retry', () => {
  it('backoff steps 10s 1m 5m 15m then 1h', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(retryDelayMs)).toEqual([
      10_000, 60_000, 300_000, 900_000, 3_600_000, 3_600_000, 3_600_000
    ])
  })

  it('connect failure retries then FAILED at attempt 10', () => {
    const outcome: SendOutcome = {kind: 'retryable', replies: [], error: 'econnrefused'}
    expect(decideNext(0, outcome, now)).toEqual({
      status: 'PENDING',
      attempts: 1,
      nextAttemptAt: new Date(now.getTime() + 10_000),
      lastError: 'econnrefused'
    })
    expect(decideNext(MAX_ATTEMPTS - 2, outcome, now).status).toBe('PENDING')
    expect(decideNext(MAX_ATTEMPTS - 1, outcome, now)).toEqual({
      status: 'FAILED',
      attempts: MAX_ATTEMPTS,
      nextAttemptAt: null,
      lastError: 'econnrefused'
    })
  })

  it('unconfirmed is NEEDS_REVIEW with no next attempt', () => {
    expect(decideNext(2, {kind: 'unconfirmed', replies: [], error: 'timeout'}, now)).toEqual({
      status: 'NEEDS_REVIEW',
      attempts: 3,
      nextAttemptAt: null,
      lastError: 'timeout'
    })
  })

  it('done is DONE', () => {
    expect(decideNext(0, {kind: 'done', replies: ['ok']}, now)).toEqual({
      status: 'DONE',
      attempts: 1,
      nextAttemptAt: null,
      lastError: null
    })
  })
})

describe('grantExpiry', () => {
  it('grantExpiry starts at now when none', () => {
    expect(grantExpiry({expiresAt: null, revokedAt: null}, now, 30, 1)).toEqual(
      new Date(now.getTime() + 30 * DAY)
    )
  })

  it('grantExpiry extends an active grant from its expiry', () => {
    const expiresAt = new Date(now.getTime() + 10 * DAY)
    expect(grantExpiry({expiresAt, revokedAt: null}, now, 30, 1)).toEqual(
      new Date(expiresAt.getTime() + 30 * DAY)
    )
  })

  it('grantExpiry restarts from now after revoke or lapse', () => {
    const future = new Date(now.getTime() + 10 * DAY)
    const past = new Date(now.getTime() - DAY)
    const want = new Date(now.getTime() + 30 * DAY)
    expect(grantExpiry({expiresAt: future, revokedAt: past}, now, 30, 1)).toEqual(want)
    expect(grantExpiry({expiresAt: past, revokedAt: null}, now, 30, 1)).toEqual(want)
    expect(grantExpiry({expiresAt: now, revokedAt: null}, now, 30, 1)).toEqual(want)
  })

  it('quantity 3 of 30 days adds 90 days', () => {
    expect(grantExpiry({expiresAt: null, revokedAt: null}, now, 30, 3)).toEqual(
      new Date(now.getTime() + 90 * DAY)
    )
  })
})

describe('publicDeliveryState', () => {
  it('is none unless PAID or DELIVERED, or without deliveries', () => {
    expect(publicDeliveryState('PENDING', ['DONE'])).toBe('none')
    expect(publicDeliveryState('PAID', [])).toBe('none')
  })
  it('is delayed on FAILED or NEEDS_REVIEW', () => {
    expect(publicDeliveryState('PAID', ['DONE', 'FAILED'])).toBe('delayed')
    expect(publicDeliveryState('PAID', ['PENDING', 'NEEDS_REVIEW'])).toBe('delayed')
  })
  it('is delivered when all DONE', () => {
    expect(publicDeliveryState('DELIVERED', ['DONE', 'DONE'])).toBe('delivered')
  })
  it('is delivering otherwise', () => {
    expect(publicDeliveryState('PAID', ['DONE', 'RUNNING'])).toBe('delivering')
    expect(publicDeliveryState('PAID', ['PENDING'])).toBe('delivering')
  })
})
