import {ForbiddenException, UnauthorizedException} from '@nestjs/common'

import {AdminSessionGuard, type SessionReader} from './admin-session.guard'

const ctx = (req: Record<string, unknown>) =>
  ({switchToHttp: () => ({getRequest: () => req})}) as never

function guard(session: Awaited<ReturnType<SessionReader>>) {
  const readSession = jest.fn<ReturnType<SessionReader>, Parameters<SessionReader>>(() =>
    Promise.resolve(session)
  )
  const cache = {
    get: jest.fn(() =>
      Promise.resolve({name: 'ADMIN', isSystem: true, permissions: ['audit.read']})
    )
  }
  const prisma = {
    user: {
      findUnique: jest.fn(() =>
        Promise.resolve<{disabledAt: Date | null; roleId: string | null} | null>({
          disabledAt: null,
          roleId: 'r1'
        })
      )
    }
  }
  return {
    g: new AdminSessionGuard(readSession, cache as never, prisma as never),
    prisma,
    readSession
  }
}

const session = (over = {}) => ({
  user: {id: 'u1', email: 'a@x.io', name: 'A'},
  session: {id: 's1', twoFactorVerifiedAt: new Date() as Date | null, ...over}
})

describe('AdminSessionGuard', () => {
  it('rejects a request without a session', async () => {
    await expect(guard(null).g.canActivate(ctx({headers: {}}))).rejects.toBeInstanceOf(
      UnauthorizedException
    )
  })

  it('passes the request cookies to the session reader', async () => {
    const {g, readSession} = guard(session())
    await g.canActivate(ctx({headers: {cookie: 'a=b'}}))
    expect(readSession.mock.calls[0]?.[0].get('cookie')).toBe('a=b')
  })

  it('asks for TOTP when the session has not passed it', async () => {
    const err = await guard(session({twoFactorVerifiedAt: null}))
      .g.canActivate(ctx({headers: {}}))
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect((err as ForbiddenException).getResponse()).toEqual({
      statusCode: 403,
      message: '2fa_required'
    })
  })

  it('rejects a disabled admin', async () => {
    const {g, prisma} = guard(session())
    prisma.user.findUnique.mockResolvedValueOnce({disabledAt: new Date(), roleId: 'r1'})
    await expect(g.canActivate(ctx({headers: {}}))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects a user without a role or row', async () => {
    const {g, prisma} = guard(session())
    prisma.user.findUnique.mockResolvedValueOnce({disabledAt: null, roleId: null})
    await expect(g.canActivate(ctx({headers: {}}))).rejects.toBeInstanceOf(UnauthorizedException)
    prisma.user.findUnique.mockResolvedValueOnce(null)
    await expect(g.canActivate(ctx({headers: {}}))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('attaches the admin context', async () => {
    const req: Record<string, unknown> = {headers: {}}
    await expect(guard(session()).g.canActivate(ctx(req))).resolves.toBe(true)
    expect(req.admin).toEqual({
      userId: 'u1',
      sessionId: 's1',
      email: 'a@x.io',
      name: 'A',
      role: {id: 'r1', name: 'ADMIN', isSystem: true},
      permissions: ['audit.read']
    })
  })
})
