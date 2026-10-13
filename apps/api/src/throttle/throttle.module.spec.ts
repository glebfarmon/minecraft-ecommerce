import {adminTracker} from './throttle.module'

const req = (cookie?: string) => ({ip: '9.9.9.9', headers: {cookie}})

describe('adminTracker', () => {
  it('keys by the session cookie, plain or __Secure- prefixed, never by the token itself', () => {
    const plain = adminTracker(req('a=1; better-auth.session_token=abc.def; b=2'))
    const secure = adminTracker(req('__Secure-better-auth.session_token=abc.def'))
    expect(plain).toBe(secure)
    expect(plain).toMatch(/^session:[0-9a-f]{64}$/)
    expect(plain).not.toContain('abc')
    expect(adminTracker(req('better-auth.session_token=other'))).not.toBe(plain)
  })

  it('falls back to the IP without a session cookie', () => {
    expect(adminTracker(req())).toBe('ip:9.9.9.9')
    expect(adminTracker(req('theme=dark'))).toBe('ip:9.9.9.9')
  })
})
