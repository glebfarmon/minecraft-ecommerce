import {renderWithProviders} from '@/test/render-with-providers'
import {renderWithStore} from '@/test/render-with-store'
import {findToast} from '@/test/toast'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

/** Opens the row menu of `email` and picks `item`. */
async function choose(email: string, item: string) {
  const user = userEvent.setup()
  const table = await screen.findByRole('table', {name: 'Invites'})
  await user.click(within(table).getByRole('button', {name: `Actions for ${email}`}))
  await user.click(await screen.findByRole('menuitem', {name: item}))
}

describe('InvitesPanel', () => {
  it('speaks Polish: the invite button and the table', async () => {
    mockApi()
    renderWithProviders(<InvitesPanel />, {locale: 'pl'})
    expect(await screen.findByRole('button', {name: 'Zaproś'})).toBeInTheDocument()
    expect(await screen.findByRole('table', {name: 'Zaproszenia'})).toBeInTheDocument()
  })

  it('lists invites with their status', async () => {
    mockApi()
    renderWithStore(<InvitesPanel />)
    const table = await screen.findByRole('table', {name: 'Invites'})
    const row = (email: string) => within(table).getByText(email).closest('tr') as HTMLElement
    expect(row('open@x.io')).toHaveTextContent('Open')
    expect(row('done@x.io')).toHaveTextContent('Accepted')
    expect(row('gone@x.io')).toHaveTextContent('Revoked')
  })

  it('offers actions only on open invites', async () => {
    mockApi()
    renderWithStore(<InvitesPanel />)
    const table = await screen.findByRole('table', {name: 'Invites'})
    expect(within(table).getByRole('button', {name: 'Actions for open@x.io'})).toBeInTheDocument()
    expect(within(table).queryByRole('button', {name: 'Actions for done@x.io'})).toBeNull()
    expect(within(table).queryByRole('button', {name: 'Actions for gone@x.io'})).toBeNull()
  })

  it('rejects an invalid email without calling the API', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    await screen.findByRole('table', {name: 'Invites'})
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
    await screen.findByRole('table', {name: 'Invites'})
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: ' New@X.io '}})
    await user.click(screen.getByRole('combobox', {name: 'Role'}))
    await user.click(await screen.findByRole('option', {name: 'SUPPORT'}))
    fireEvent.click(screen.getByRole('button', {name: 'Send invite'}))
    const req = await mutation(fetchMock)
    expect(req.method).toBe('POST')
    expect(req.url).toMatch(/\/api\/admin\/invites$/)
    expect(await req.clone().json()).toEqual({email: 'new@x.io', roleId: 'r2'})
    expect(await findToast()).toHaveTextContent('Invite sent to new@x.io.')
  })

  it('does not offer OWNER as an invite role', async () => {
    mockApi()
    renderWithStore(<InvitesPanel />)
    await screen.findByRole('table', {name: 'Invites'})
    await userEvent.setup().click(screen.getByRole('combobox', {name: 'Role'}))
    await screen.findByRole('option', {name: 'ADMIN'})
    expect(screen.queryByRole('option', {name: 'OWNER'})).not.toBeInTheDocument()
  })

  it('resends an open invite', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    await choose('open@x.io', 'Resend')
    const req = await mutation(fetchMock)
    expect(req.method).toBe('POST')
    expect(req.url).toMatch(/\/api\/admin\/invites\/i1\/resend$/)
    expect(await findToast()).toHaveTextContent('Invite re-sent to open@x.io.')
  })

  it('sends nothing on Revoke until confirmed and offers to keep the invite', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    await choose('open@x.io', 'Revoke')
    expect(screen.getByText(/The link stops working/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Keep invite'}))
    expect(
      (fetchMock.mock.calls as [unknown][]).some(
        ([r]) => r instanceof Request && r.method !== 'GET'
      )
    ).toBe(false)
    expect(screen.queryByText(/The link stops working/)).not.toBeInTheDocument()
  })

  it('revokes an open invite after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<InvitesPanel />)
    await choose('open@x.io', 'Revoke')
    fireEvent.click(screen.getByRole('button', {name: 'Revoke invite'}))
    const req = await mutation(fetchMock)
    expect(req.method).toBe('DELETE')
    expect(req.url).toMatch(/\/api\/admin\/invites\/i1$/)
  })

  it('explains that Resend recovers a failed email', async () => {
    mockApi({status: 503, message: 'mail_failed'})
    renderWithStore(<InvitesPanel />)
    await choose('open@x.io', 'Resend')
    expect(await findToast('alert')).toHaveTextContent(/Use Resend/)
  })

  it('shows an empty state without invites', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(input => {
      const url = String(input instanceof Request ? input.url : input)
      return Promise.resolve(Response.json(url.endsWith('/roles') ? roles : []))
    })
    renderWithStore(<InvitesPanel />)
    expect(await screen.findByText('No pending invites.')).toBeInTheDocument()
  })
})
