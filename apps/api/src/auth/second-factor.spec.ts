import {secondFactorGate, shouldStamp} from './second-factor'

const session = (over: {verified?: boolean; enabled?: boolean} = {}) => ({
  user: {id: 'u1', twoFactorEnabled: over.enabled ?? false},
  session: {twoFactorVerifiedAt: over.verified ? new Date() : null}
})
const enrolled = (value: boolean) => jest.fn(() => Promise.resolve(value))

describe('secondFactorGate', () => {
  it('ignores routes it does not guard, without reading the session', async () => {
    const read = jest.fn(() => Promise.resolve(null))
    await expect(secondFactorGate('/sign-in/email-otp', read, enrolled(true))).resolves.toBe('ok')
    expect(read).not.toHaveBeenCalled()
  })

  it('refuses a guarded route when the session cannot be read (fail closed)', async () => {
    for (const path of ['/two-factor/disable', '/two-factor/verify-backup-code'])
      await expect(
        secondFactorGate(path, () => Promise.resolve(null), enrolled(true))
      ).resolves.toBe('unauthorized')
  })

  it('keeps 2FA settings away from an unverified session of an enrolled user', async () => {
    const read = () => Promise.resolve(session({enabled: true}))
    await expect(secondFactorGate('/two-factor/get-totp-uri', read, enrolled(true))).resolves.toBe(
      '2fa_required'
    )
  })

  it('opens 2FA settings to a verified session, and during first enrollment', async () => {
    await expect(
      secondFactorGate(
        '/two-factor/generate-backup-codes',
        () => Promise.resolve(session({enabled: true, verified: true})),
        enrolled(true)
      )
    ).resolves.toBe('ok')
    await expect(
      secondFactorGate('/two-factor/enable', () => Promise.resolve(session()), enrolled(false))
    ).resolves.toBe('ok')
  })

  it('refuses a backup code before the user has a verified TOTP', async () => {
    await expect(
      secondFactorGate(
        '/two-factor/verify-backup-code',
        () => Promise.resolve(session()),
        enrolled(false)
      )
    ).resolves.toBe('2fa_required')
  })

  it('accepts a backup code from an enrolled user', async () => {
    await expect(
      secondFactorGate(
        '/two-factor/verify-backup-code',
        () => Promise.resolve(session()),
        enrolled(true)
      )
    ).resolves.toBe('ok')
  })
})

describe('shouldStamp', () => {
  it('stamps after verify-totp', async () => {
    await expect(shouldStamp('/two-factor/verify-totp', 'u1', enrolled(false))).resolves.toBe(true)
  })

  it('stamps after a backup code only for an enrolled user', async () => {
    await expect(shouldStamp('/two-factor/verify-backup-code', 'u1', enrolled(true))).resolves.toBe(
      true
    )
    await expect(
      shouldStamp('/two-factor/verify-backup-code', 'u1', enrolled(false))
    ).resolves.toBe(false)
  })

  it('never stamps other routes', async () => {
    await expect(shouldStamp('/two-factor/enable', 'u1', enrolled(true))).resolves.toBe(false)
  })
})
