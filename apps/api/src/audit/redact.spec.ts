import {redact} from './redact'

describe('redact', () => {
  it('hides secrets at any depth and keeps the rest', () => {
    expect(
      redact({
        email: 'a@x.io',
        otp: '123456',
        nested: {token: 't', list: [{backupCodes: ['x']}]},
        totpURI: 'otpauth://'
      })
    ).toEqual({
      email: 'a@x.io',
      otp: '[redacted]',
      nested: {token: '[redacted]', list: [{backupCodes: '[redacted]'}]},
      totpURI: '[redacted]'
    })
  })
  it('leaves primitives alone', () => {
    expect(redact('x')).toBe('x')
    expect(redact(null)).toBeNull()
  })
})
