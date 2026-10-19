import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {AdminsTable} from './admins-table'

const admins = [
  {
    id: 'o',
    email: 'owner@x.io',
    name: 'Owner',
    role: {id: 'r0', name: 'OWNER'},
    twoFactorEnabled: true,
    disabledAt: null
  },
  {
    id: 'a',
    email: 'ann@x.io',
    name: 'Ann',
    role: {id: 'r1', name: 'ADMIN'},
    twoFactorEnabled: true,
    disabledAt: null
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
  {id: 'r2', name: 'SUPPORT', isSystem: true, permissions: []},
  {id: 'r3', name: 'Auditor', isSystem: false, permissions: ['audit.read']},
  {id: 'r4', name: 'Boss', isSystem: false, permissions: ['role.write']}
]

function mockApi(failWith?: {status: number; message: string}) {
  return jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    const method = input instanceof Request ? input.method : (init?.method ?? 'GET')
    if (url.endsWith('/api/admin/admins') && method === 'GET')
      return Promise.resolve(Response.json(admins))
    if (url.endsWith('/api/admin/roles')) return Promise.resolve(Response.json(roles))
    if (failWith) {
      return Promise.resolve(
        Response.json(
          {statusCode: failWith.status, message: failWith.message},
          {status: failWith.status}
        )
      )
    }
    return Promise.resolve(Response.json({...admins[1], disabledAt: '2026-10-12T00:00:00.000Z'}))
  })
}

function mutations(fetchMock: jest.SpyInstance) {
  return (fetchMock.mock.calls as [unknown][])
    .map(([req]) => req)
    .filter((req): req is Request => req instanceof Request && req.method !== 'GET')
}

/** Opens the row menu of `email` and picks `item`. */
async function choose(email: string, item: string) {
  const user = userEvent.setup()
  const table = await screen.findByRole('table', {name: 'Admins'})
  await user.click(within(table).getByRole('button', {name: `Actions for ${email}`}))
  await user.click(await screen.findByRole('menuitem', {name: item}))
}

describe('AdminsTable', () => {
  it('lists admins and protects the owner row', async () => {
    mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    const table = await screen.findByRole('table', {name: 'Admins'})
    expect(within(table).getByText('ann@x.io')).toBeInTheDocument()
    const ownerRow = within(table).getByText('owner@x.io').closest('tr') as HTMLElement
    expect(within(ownerRow).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('combobox', {name: 'Role of owner@x.io'})).not.toBeInTheDocument()
  })

  it('removes an admin after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    await choose('ann@x.io', 'Remove')
    expect(screen.getByText(/signed out everywhere/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Remove'}))
    await waitFor(() => {
      expect(mutations(fetchMock).some(req => req.method === 'DELETE')).toBe(true)
    })
  })

  it('does not remove anyone before the confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    await choose('ann@x.io', 'Remove')
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))
    expect(mutations(fetchMock).map(r => r.method + r.url)).toEqual([])
    expect(screen.queryByText(/signed out everywhere/)).not.toBeInTheDocument()
  })

  it('changes a role after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    await choose('ann@x.io', 'Change role')
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', {name: 'Role of ann@x.io'}))
    await user.click(await screen.findByRole('option', {name: 'SUPPORT'}))
    expect(screen.getByText(/to SUPPORT\? They are signed out everywhere/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Change role'}))
    await waitFor(() => {
      const patch = mutations(fetchMock).find(req => req.method === 'PATCH')
      expect(patch?.url).toMatch(/\/api\/admin\/admins\/a\/role$/)
      expect(patch).toBeDefined()
    })
    const patch = mutations(fetchMock).find(req => req.method === 'PATCH') as Request
    expect(await patch.clone().json()).toEqual({roleId: 'r2'})
    await waitFor(() => {})
  })

  it('resets two-factor after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    await choose('ann@x.io', 'Reset 2FA')
    fireEvent.click(screen.getByRole('button', {name: 'Reset'}))
    await waitFor(() => {
      const post = mutations(fetchMock).find(req => req.method === 'POST')
      expect(post?.url).toMatch(/\/api\/admin\/admins\/a\/reset-2fa$/)
    })
  })

  it('offers no role change without role.write', async () => {
    mockApi()
    const user = userEvent.setup()
    renderWithStore(<AdminsTable canChangeRoles={false} />)
    const table = await screen.findByRole('table', {name: 'Admins'})
    await user.click(within(table).getByRole('button', {name: 'Actions for ann@x.io'}))
    await screen.findByRole('menuitem', {name: 'Remove'})
    expect(screen.queryByRole('menuitem', {name: 'Change role'})).not.toBeInTheDocument()
  })

  it('offers only roles the viewer could hand out and never OWNER', async () => {
    mockApi()
    renderWithStore(<AdminsTable canChangeRoles held={['admin.invite', 'audit.read']} />)
    await choose('ann@x.io', 'Change role')
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', {name: 'Role of ann@x.io'}))
    const names = (await screen.findAllByRole('option')).map(o => o.textContent)
    expect(names).toEqual(['ADMIN', 'SUPPORT', 'Auditor'])
  })

  it('shows a clear message when the API refuses', async () => {
    mockApi({status: 400, message: 'owner_protected'})
    renderWithStore(<AdminsTable canChangeRoles />)
    await choose('ann@x.io', 'Remove')
    fireEvent.click(screen.getByRole('button', {name: 'Remove'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be changed/)
  })
})
