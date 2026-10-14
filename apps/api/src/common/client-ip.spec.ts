import {CLIENT_IP_HEADER, clientIp, requestIp} from './client-ip'

const CF = {TRUST_CF_CONNECTING_IP: 'true'}

describe('clientIp', () => {
  it('uses CF-Connecting-IP only when TRUST_CF_CONNECTING_IP=true', () => {
    const headers = {'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': '10.0.0.1, 203.0.113.7'}
    expect(clientIp(headers, '172.18.0.2', CF)).toBe('198.51.100.9')
    expect(clientIp(headers, '172.18.0.2', {})).toBe('203.0.113.7')
    expect(clientIp(headers, '172.18.0.2', {TRUST_CF_CONNECTING_IP: '1'})).toBe('203.0.113.7')
  })

  it('falls through to X-Forwarded-For when the trusted Cloudflare header is missing', () => {
    expect(clientIp({'x-forwarded-for': '203.0.113.7'}, '172.18.0.2', CF)).toBe('203.0.113.7')
  })

  it('takes the LAST X-Forwarded-For hop: spoofed first hops are ignored', () => {
    for (const spoof of ['1.1.1.1', '2.2.2.2', '9.9.9.9, 8.8.8.8'])
      expect(clientIp({'x-forwarded-for': `${spoof}, 203.0.113.7`}, undefined, {})).toBe(
        '203.0.113.7'
      )
    // Node joins repeated headers into an array on some paths.
    expect(clientIp({'x-forwarded-for': ['1.1.1.1', ' 203.0.113.8 ']}, undefined, {})).toBe(
      '203.0.113.8'
    )
  })

  it('falls back to the socket peer, then to a shared "unknown" bucket', () => {
    expect(clientIp({}, '172.18.0.2', {})).toBe('172.18.0.2')
    expect(clientIp({'x-forwarded-for': ' , '}, '172.18.0.2', {})).toBe('172.18.0.2')
    expect(clientIp({}, undefined, {})).toBe('unknown')
    expect(clientIp(undefined, undefined, {})).toBe('unknown')
  })

  it('reads web Headers as well as Node header objects', () => {
    const headers = new Headers({'x-forwarded-for': '1.1.1.1, 203.0.113.7'})
    expect(clientIp(headers, undefined, {})).toBe('203.0.113.7')
    expect(clientIp(new Headers({'cf-connecting-ip': '198.51.100.9'}), undefined, CF)).toBe(
      '198.51.100.9'
    )
  })
})

describe('requestIp', () => {
  it('prefers the address the HTTP layer resolved and stamped on the request', () => {
    const headers = new Headers({[CLIENT_IP_HEADER]: '203.0.113.50', 'x-forwarded-for': '1.1.1.1'})
    expect(requestIp(headers)).toBe('203.0.113.50')
  })

  it('resolves from the headers when nothing was stamped (direct auth.api calls)', () => {
    expect(requestIp(new Headers({'x-forwarded-for': '1.1.1.1, 203.0.113.7'}))).toBe('203.0.113.7')
    expect(requestIp(undefined)).toBe('unknown')
  })
})
