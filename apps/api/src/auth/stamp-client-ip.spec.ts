import {CLIENT_IP_HEADER} from '../common/client-ip'
import {stampClientIp} from './stamp-client-ip'

describe('stampClientIp', () => {
  it('overwrites a client-sent address with the one the shared rule resolves', () => {
    const req = {
      headers: {[CLIENT_IP_HEADER]: '6.6.6.6', 'x-forwarded-for': '1.1.1.1, 203.0.113.7'},
      socket: {remoteAddress: '172.18.0.2'}
    }
    const next = jest.fn()
    stampClientIp(req, {}, next)
    expect(req.headers[CLIENT_IP_HEADER]).toBe('203.0.113.7')
    expect(next).toHaveBeenCalled()
  })

  it('uses the socket peer without forwarding headers', () => {
    const req: {headers: Record<string, string>; socket: object} = {
      headers: {},
      socket: {remoteAddress: '172.18.0.2'}
    }
    stampClientIp(req, {}, jest.fn())
    expect(req.headers[CLIENT_IP_HEADER]).toBe('172.18.0.2')
  })
})
