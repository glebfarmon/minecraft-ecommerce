import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {InvitesPanel} from './invites-panel'

const future = '2999-01-01T00:00:00.000Z'
const invites = [
  {
    id: 'i1',
    email: 'open@x.io',
    role: {id: 'r1', name: 'ADMIN'},
    expiresAt: future,
    acceptedAt: null,
    revokedAt: null
  },
  {
    id: 'i2',
    email: 'done@x.io',
    role: {id: 'r1', name: 'ADMIN'},
    expiresAt: future,
    acceptedAt: '2026-10-01T00:00:00.000Z',
    revokedAt: null
  },
  {
    id: 'i3',
    email: 'gone@x.io',
    role: {id: 'r2', name: 'SUPPORT'},
    expiresAt: future,
    acceptedAt: null,
    revokedAt: '2026-10-02T00:00:00.000Z'
  }
]
const roles = [
  {
    id: 'r0',
    name: 'OWNER',
    isSystem: true,
    permissions: ['admin.invite', 'role.write', 'audit.read']
  },
  {id: 'r1', name: 'ADMIN', isSystem: true, permissions: ['admin.invite', 'audit.read']},
  {id: 'r2', name: 'SUPPORT', isSystem: true, permissions: []}
]

function mockApi(failWith?: {status: number; message: string}) {
  return jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    const method = input instanceof Request ? input.method : (init?.method ?? 'GET')
    if (url.endsWith('/api/admin/invites') && method === 'GET')
      return Promise.resolve(Response.json(invites))
    if (url.endsWith('/api/admin/roles')) return Promise.resolve(Response.json(roles))
    if (failWith) {
      return Promise.resolve(
        Response.json(
          {statusCode: failWith.status, message: failWith.message},
          {status: failWith.status}
        )
      )
    }
    return Promise.resolve(Response.json(invites[0], {status: 201}))
  })
}

async function mutation(fetchMock: jest.SpyInstance) {
  return waitFor(() => {
    const req = (fetchMock.mock.calls as [unknown][])
      .map(([r]) => r)
      .find((r): r is Request => r instanceof Request && r.method !== 'GET')
    expect(req).toBeDefined()
    return req as Request
  })
}

describe('InvitesPanel', () => {
  it('lists invites with their status', async () => {
    mockApi()
    renderWithStore(<InvitesPanel />)
    const row = async (email: string) =>
      (await screen.findByText(email)).closest('tr') as HTMLElement
    expect(await row('open@x.io')).toHaveTextContent('Open')
    expect(await row('done@x.io')).toHaveTextContent('Accepted')
    expect(await row('gone@x.io')).toHaveTextContent('Revoked')
  })

  it('offers Resend and Cancel only on open invites', async () => {
    mockApi()
    renderWithStore(<InvitesPanel />)
    await screen.findByText('open@x.io')
    expect(screen.getByRole('button', {name: 'Resend open@x.io'})).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Resend done@x.io'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Cancel gone@x.io'})).not.toBeInTheDocument()
  })

  it('rejects an invalid email without calling the API', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    await screen.findByText('open@x.io')
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'nope'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send invite'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(
      (fetchMock.mock.calls as [unknown][]).some(
        ([r]) => r instanceof Request && r.method === 'POST'
      )
    ).toBe(false)
  })

  it('creates an invite with the normalised email and chosen role', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    await screen.findByText('open@x.io')
    await screen.findByRole('option', {name: 'SUPPORT'})
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: ' New@X.io '}})
    fireEvent.change(screen.getByLabelText('Role'), {target: {value: 'r2'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send invite'}))
    const req = await mutation(fetchMock)
    expect(req.method).toBe('POST')
    expect(req.url).toMatch(/\/api\/admin\/invites$/)
    expect(await req.clone().json()).toEqual({email: 'new@x.io', roleId: 'r2'})
  })

  it('does not offer OWNER as an invite role', async () => {
    mockApi()
    renderWithStore(<InvitesPanel />)
    await screen.findByRole('option', {name: 'ADMIN'})
    expect(screen.queryByRole('option', {name: 'OWNER'})).not.toBeInTheDocument()
  })

  it('resends an open invite', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    fireEvent.click(await screen.findByRole('button', {name: 'Resend open@x.io'}))
    const req = await mutation(fetchMock)
    expect(req.method).toBe('POST')
    expect(req.url).toMatch(/\/api\/admin\/invites\/i1\/resend$/)
  })

  it('sends nothing on the first Cancel click and offers to keep the invite', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    fireEvent.click(await screen.findByRole('button', {name: 'Cancel open@x.io'}))
    expect(screen.getByText(/The link stops working/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Keep invite'}))
    expect(
      (fetchMock.mock.calls as [unknown][]).some(
        ([r]) => r instanceof Request && r.method !== 'GET'
      )
    ).toBe(false)
    expect(screen.getByRole('button', {name: 'Cancel open@x.io'})).toBeInTheDocument()
  })

  it('revokes an open invite after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    fireEvent.click(await screen.findByRole('button', {name: 'Cancel open@x.io'}))
    fireEvent.click(screen.getByRole('button', {name: 'Revoke invite'}))
    const req = await mutation(fetchMock)
    expect(req.method).toBe('DELETE')
    expect(req.url).toMatch(/\/api\/admin\/invites\/i1$/)
  })

  it('explains that Resend recovers a failed email', async () => {
    mockApi({status: 503, message: 'mail_failed'})
    renderWithStore(<InvitesPanel />)
    fireEvent.click(await screen.findByRole('button', {name: 'Resend open@x.io'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Use Resend/)
  })
})
