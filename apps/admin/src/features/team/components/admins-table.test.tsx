import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

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

describe('AdminsTable', () => {
  it('lists admins and protects the owner row', async () => {
    mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    expect(await screen.findByText('ann@x.io')).toBeInTheDocument()
    const ownerRow = screen.getByText('owner@x.io').closest('tr') as HTMLElement
    expect(ownerRow).not.toHaveTextContent('Remove')
    expect(ownerRow).not.toHaveTextContent('Reset 2FA')
    expect(screen.queryByRole('combobox', {name: 'Role of owner@x.io'})).not.toBeInTheDocument()
  })

  it('removes an admin after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    fireEvent.click(await screen.findByRole('button', {name: 'Remove ann@x.io'}))
    expect(screen.getByText(/signed out everywhere/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Remove'}))
    await waitFor(() => {
      expect(mutations(fetchMock).some(req => req.method === 'DELETE')).toBe(true)
    })
  })

  it('does not remove anyone before the confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    fireEvent.click(await screen.findByRole('button', {name: 'Remove ann@x.io'}))
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))
    expect(mutations(fetchMock).map(r => r.method + r.url)).toEqual([])
    expect(screen.getByRole('button', {name: 'Remove ann@x.io'})).toBeInTheDocument()
  })

  it('changes a role after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    const picker = await screen.findByRole('combobox', {name: 'Role of ann@x.io'})
    fireEvent.change(picker, {target: {value: 'r2'}})
    expect(screen.getByText(/to SUPPORT\? They are signed out everywhere/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Change role'}))
    await waitFor(() => {
      const patch = mutations(fetchMock).find(req => req.method === 'PATCH')
      expect(patch?.url).toMatch(/\/api\/admin\/admins\/a\/role$/)
    })
  })

  it('resets two-factor after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    fireEvent.click(await screen.findByRole('button', {name: 'Reset 2FA ann@x.io'}))
    fireEvent.click(screen.getByRole('button', {name: 'Reset'}))
    await waitFor(() => {
      const post = mutations(fetchMock).find(req => req.method === 'POST')
      expect(post?.url).toMatch(/\/api\/admin\/admins\/a\/reset-2fa$/)
    })
  })

  it('hides the role picker without role.write', async () => {
    mockApi()
    renderWithStore(<AdminsTable canChangeRoles={false} />)
    await screen.findByText('ann@x.io')
    expect(screen.queryByRole('combobox', {name: 'Role of ann@x.io'})).not.toBeInTheDocument()
  })

  it('offers only roles the viewer could hand out and never OWNER', async () => {
    mockApi()
    renderWithStore(<AdminsTable canChangeRoles held={['admin.invite', 'audit.read']} />)
    const picker = await screen.findByRole('combobox', {name: 'Role of ann@x.io'})
    const names = Array.from(picker.querySelectorAll('option')).map(o => o.textContent)
    expect(names).toEqual(['ADMIN', 'SUPPORT', 'Auditor'])
  })

  it('shows a clear message when the API refuses', async () => {
    mockApi({status: 400, message: 'owner_protected'})
    renderWithStore(<AdminsTable canChangeRoles />)
    fireEvent.click(await screen.findByRole('button', {name: 'Remove ann@x.io'}))
    fireEvent.click(screen.getByRole('button', {name: 'Remove'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be changed/)
  })
})
