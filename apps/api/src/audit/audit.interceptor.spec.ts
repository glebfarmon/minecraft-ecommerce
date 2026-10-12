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
      ip: '1.2.3.4',
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
        ctx({method: 'POST', url: '/api/admin/x?y=1', admin: {userId: 'u1'}, ip: '::1'}),
        {handle: () => of({})}
      )
    )
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({action: 'post /api/admin/x', actorId: 'u1'})
    )
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
