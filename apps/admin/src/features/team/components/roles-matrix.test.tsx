import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {RolesMatrix} from './roles-matrix'

const roles = [
  {
    id: 'r0',
    name: 'OWNER',
    isSystem: true,
    permissions: ['admin.invite', 'role.write', 'audit.read']
  },
  {id: 'r1', name: 'ADMIN', isSystem: true, permissions: ['admin.invite', 'audit.read']},
  {id: 'r3', name: 'Auditor', isSystem: false, permissions: ['audit.read']}
]

function mockApi(failWith?: {status: number; message: string}) {
  return jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    const method = input instanceof Request ? input.method : (init?.method ?? 'GET')
    if (url.endsWith('/api/admin/roles') && method === 'GET')
      return Promise.resolve(Response.json(roles))
    if (failWith) {
      return Promise.resolve(
        Response.json(
          {statusCode: failWith.status, message: failWith.message},
          {status: failWith.status}
        )
      )
    }
    return Promise.resolve(Response.json(roles[2], {status: 200}))
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

describe('RolesMatrix', () => {
  it('shows system roles read-only', async () => {
    mockApi()
    renderWithStore(<RolesMatrix editable />)
    const box = await screen.findByRole('checkbox', {name: 'ADMIN audit.read'})
    expect(box).toBeDisabled()
    expect(box).toBeChecked()
    expect(screen.queryByRole('button', {name: 'Delete ADMIN'})).not.toBeInTheDocument()
  })

  it('makes custom roles read-only without role.write', async () => {
    mockApi()
    renderWithStore(<RolesMatrix editable={false} />)
    expect(await screen.findByRole('checkbox', {name: 'Auditor role.write'})).toBeDisabled()
    expect(screen.queryByRole('button', {name: 'Save Auditor'})).not.toBeInTheDocument()
    expect(screen.queryByRole('form', {name: 'New role'})).not.toBeInTheDocument()
  })

  it('disables permissions the viewer does not hold', async () => {
    mockApi()
    renderWithStore(<RolesMatrix editable held={['audit.read']} />)
    expect(await screen.findByRole('checkbox', {name: 'Auditor audit.read'})).toBeEnabled()
    expect(screen.getByRole('checkbox', {name: 'Auditor role.write'})).toBeDisabled()
  })

  it('saves a custom role with the ticked permissions', async () => {
    const fetchMock = mockApi()
    renderWithStore(<RolesMatrix editable />)
    expect(await screen.findByRole('button', {name: 'Save Auditor'})).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', {name: 'Auditor admin.invite'}))
    fireEvent.click(screen.getByRole('button', {name: 'Save Auditor'}))
    expect(screen.getByText(/Everyone with this role is signed out/)).toBeInTheDocument()
    expect(
      (fetchMock.mock.calls as [unknown][]).some(
        ([r]) => r instanceof Request && r.method !== 'GET'
      )
    ).toBe(false)
    fireEvent.click(screen.getByRole('button', {name: 'Save role'}))
    const req = await mutation(fetchMock)
    expect(req.method).toBe('PATCH')
    expect(req.url).toMatch(/\/api\/admin\/roles\/r3$/)
    expect(await req.clone().json()).toEqual({
      name: 'Auditor',
      permissions: ['audit.read', 'admin.invite']
    })
  })

  it('creates a role', async () => {
    const fetchMock = mockApi()
    renderWithStore(<RolesMatrix editable />)
    await screen.findByText('Auditor')
    fireEvent.change(screen.getByLabelText('New role name'), {target: {value: ' Editor '}})
    fireEvent.click(screen.getByLabelText('audit.read', {selector: '#new-audit\\.read'}))
    fireEvent.click(screen.getByRole('button', {name: 'Create role'}))
    const req = await mutation(fetchMock)
    expect(req.method).toBe('POST')
    expect(await req.clone().json()).toEqual({name: 'Editor', permissions: ['audit.read']})
  })

  it('rejects a too-short role name without calling the API', async () => {
    const fetchMock = mockApi()
    renderWithStore(<RolesMatrix editable />)
    await screen.findByText('Auditor')
    fireEvent.change(screen.getByLabelText('New role name'), {target: {value: 'x'}})
    fireEvent.click(screen.getByRole('button', {name: 'Create role'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Use 2 to 40 characters')
    expect(fetchMock.mock.calls).toHaveLength(1)
  })

  it('sends nothing on the first Delete click', async () => {
    const fetchMock = mockApi()
    renderWithStore(<RolesMatrix editable />)
    fireEvent.click(await screen.findByRole('button', {name: 'Delete Auditor'}))
    expect(screen.getByText(/Fails while the role is in use/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Back'}))
    expect(fetchMock.mock.calls).toHaveLength(1)
  })

  it('deletes a custom role after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<RolesMatrix editable />)
    fireEvent.click(await screen.findByRole('button', {name: 'Delete Auditor'}))
    fireEvent.click(screen.getByRole('button', {name: 'Delete role'}))
    const req = await mutation(fetchMock)
    expect(req.method).toBe('DELETE')
    expect(req.url).toMatch(/\/api\/admin\/roles\/r3$/)
  })

  it('explains why a role in use cannot be deleted', async () => {
    mockApi({status: 409, message: 'role_in_use'})
    renderWithStore(<RolesMatrix editable />)
    fireEvent.click(await screen.findByRole('button', {name: 'Delete Auditor'}))
    fireEvent.click(screen.getByRole('button', {name: 'Delete role'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/still assigned/)
  })

  it('says what the API refused when granting too much', async () => {
    mockApi({status: 403, message: 'cannot_grant'})
    renderWithStore(<RolesMatrix editable />)
    fireEvent.click(await screen.findByRole('checkbox', {name: 'Auditor admin.invite'}))
    fireEvent.click(screen.getByRole('button', {name: 'Save Auditor'}))
    fireEvent.click(screen.getByRole('button', {name: 'Save role'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/permissions you hold/)
  })
})
