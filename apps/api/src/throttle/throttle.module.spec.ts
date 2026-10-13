import {adminTracker, ipTracker, isAdminPath, throttleKey} from './throttle.module'

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

describe('isAdminPath', () => {
  it('matches the admin API whatever the case, as Express routing does', () => {
    for (const url of ['/api/admin', '/api/admin/me', '/API/Admin/admins', '/api/admin?x=1'])
      expect(isAdminPath({url, headers: {}})).toBe(true)
  })

  it('leaves other routes alone', () => {
    for (const url of ['/api/health', '/api/administrator', '/api/auth/admin', '/admin'])
      expect(isAdminPath({url, headers: {}})).toBe(false)
  })
})

describe('throttleKey', () => {
  it('depends only on the throttler and the tracker, not on the route', () => {
    expect(throttleKey('admin', 'session:a')).toBe(throttleKey('admin', 'session:a'))
    expect(throttleKey('admin', 'session:a')).not.toBe(throttleKey('admin', 'session:b'))
    expect(throttleKey('admin', 'ip:1')).not.toBe(throttleKey('adminIp', 'ip:1'))
    expect(throttleKey('admin', 'session:a')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('ipTracker', () => {
  it('uses the shared client-IP rule (last X-Forwarded-For hop, then the socket peer)', () => {
    const prev = process.env.TRUST_CF_CONNECTING_IP
    delete process.env.TRUST_CF_CONNECTING_IP
    try {
      expect(
        ipTracker({
          ip: '172.18.0.2',
          socket: {remoteAddress: '172.18.0.2'},
          headers: {'x-forwarded-for': '6.6.6.6, 203.0.113.7'}
        })
      ).toBe('ip:203.0.113.7')
      expect(ipTracker({socket: {remoteAddress: '172.18.0.2'}, headers: {}})).toBe('ip:172.18.0.2')
    } finally {
      if (prev !== undefined) process.env.TRUST_CF_CONNECTING_IP = prev
    }
  })
})
