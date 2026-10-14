/** @jest-environment node */
import {getMe} from './session'

jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({toString: () => 'better-auth.session_token=abc'})
}))

const me = {
  id: 'u1',
  email: 'a@x.io',
  name: 'A',
  role: {id: 'r', name: 'ADMIN', isSystem: true, permissions: []},
  permissions: []
}

describe('getMe', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('forwards the cookies and returns the admin', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(me), {status: 200}))
    await expect(getMe()).resolves.toEqual({state: 'ok', me})
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {cookie: 'better-auth.session_token=abc'},
      cache: 'no-store'
    })
  })

  it('reports a missing session and a pending 2FA', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', {status: 401}))
    await expect(getMe()).resolves.toEqual({state: 'signed-out'})
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({message: '2fa_required'}), {status: 403}))
    await expect(getMe()).resolves.toEqual({state: '2fa'})
  })

  it('throws on a server error instead of reporting a sign-out', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', {status: 500}))
    await expect(getMe()).rejects.toThrow('500')
  })

  it('throws on a 403 that is not the 2FA gate', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({message: 'forbidden'}), {status: 403}))
    await expect(getMe()).rejects.toThrow('403')
  })
})
