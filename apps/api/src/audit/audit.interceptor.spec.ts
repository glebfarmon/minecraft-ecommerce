import {lastValueFrom, of} from 'rxjs'

import {AuditInterceptor} from './audit.interceptor'

const ctx = (req: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({getRequest: () => req}),
    getHandler: () => () => undefined,
    getClass: () => Object
  }) as never

describe('AuditInterceptor', () => {
  it('records a mutating admin request with before, after and actor', async () => {
    const record = jest.fn(() => Promise.resolve())
    const reflector = {
      getAllAndOverride: jest.fn(() => ({action: 'role.update', entityType: 'role'}))
    }
    const interceptor = new AuditInterceptor({record} as never, reflector as never)
    const req = {
      method: 'PATCH',
      params: {id: 'r1'},
      headers: {},
      socket: {remoteAddress: '1.2.3.4'},
      admin: {userId: 'u1'},
      auditBefore: {name: 'Old'}
    }
    await lastValueFrom(
      interceptor.intercept(ctx(req), {handle: () => of({id: 'r1', name: 'New', token: 's'})})
    )
    expect(record).toHaveBeenCalledWith({
      actorId: 'u1',
      action: 'role.update',
      entityType: 'role',
      entityId: 'r1',
      before: {name: 'Old'},
      after: {id: 'r1', name: 'New', token: '[redacted]'},
      ip: '1.2.3.4'
    })
  })

  it('names unannotated handlers after the method and path', async () => {
    const record = jest.fn(() => Promise.resolve())
    const interceptor = new AuditInterceptor(
      {record} as never,
      {getAllAndOverride: () => undefined} as never
    )
    await lastValueFrom(
      interceptor.intercept(
        ctx({
          method: 'POST',
          url: '/api/admin/x?y=1',
          admin: {userId: 'u1'},
          headers: {},
          socket: {remoteAddress: '::1'}
        }),
        {handle: () => of({})}
      )
    )
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({action: 'post /api/admin/x', actorId: 'u1'})
    )
  })

  describe('client address (shared rule, common/client-ip.ts)', () => {
    const recordedIp = async (headers: Record<string, string>) => {
      const record = jest.fn<Promise<void>, [{ip: string}]>(() => Promise.resolve())
      const interceptor = new AuditInterceptor(
        {record} as never,
        {getAllAndOverride: () => undefined} as never
      )
      await lastValueFrom(
        interceptor.intercept(
          ctx({
            method: 'POST',
            url: '/api/admin/x',
            admin: {userId: 'u1'},
            ip: '172.18.0.2',
            headers,
            socket: {remoteAddress: '172.18.0.2'}
          }),
          {handle: () => of({})}
        )
      )
      return record.mock.calls[0]?.[0].ip
    }
    const prev = process.env.TRUST_CF_CONNECTING_IP
    afterEach(() => {
      if (prev === undefined) delete process.env.TRUST_CF_CONNECTING_IP
      else process.env.TRUST_CF_CONNECTING_IP = prev
    })

    it('records the last X-Forwarded-For hop, not a spoofed first hop or the proxy peer', async () => {
      delete process.env.TRUST_CF_CONNECTING_IP
      expect(await recordedIp({'x-forwarded-for': '6.6.6.6, 10.0.0.9'})).toBe('10.0.0.9')
    })

    it('records CF-Connecting-IP only when TRUST_CF_CONNECTING_IP=true', async () => {
      const headers = {'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': '6.6.6.6, 10.0.0.9'}
      delete process.env.TRUST_CF_CONNECTING_IP
      expect(await recordedIp(headers)).toBe('10.0.0.9')
      process.env.TRUST_CF_CONNECTING_IP = 'true'
      expect(await recordedIp(headers)).toBe('198.51.100.9')
    })

    it('falls back to the socket peer', async () => {
      delete process.env.TRUST_CF_CONNECTING_IP
      expect(await recordedIp({})).toBe('172.18.0.2')
    })
  })

  it('takes entityId from the response body: numbers become strings, other values are ignored', async () => {
    const run = async (body: unknown) => {
      const record = jest.fn(() => Promise.resolve())
      const interceptor = new AuditInterceptor(
        {record} as never,
        {getAllAndOverride: () => ({action: 'x.y', entityType: 'x'})} as never
      )
      const req = {method: 'POST', params: {}, headers: {}, socket: {}, admin: {userId: 'u1'}}
      await lastValueFrom(interceptor.intercept(ctx(req), {handle: () => of(body)}))
      return (record.mock.calls[0] as unknown as [{entityId?: string}])[0].entityId
    }
    expect(await run({id: 7})).toBe('7')
    expect(await run({id: null})).toBeUndefined()
    expect(await run({id: {a: 1}})).toBeUndefined()
  })

  it('skips reads', async () => {
    const record = jest.fn()
    const interceptor = new AuditInterceptor(
      {record} as never,
      {getAllAndOverride: () => undefined} as never
    )
    await lastValueFrom(
      interceptor.intercept(ctx({method: 'GET', params: {}, admin: {userId: 'u1'}}), {
        handle: () => of({})
      })
    )
    expect(record).not.toHaveBeenCalled()
  })
})
