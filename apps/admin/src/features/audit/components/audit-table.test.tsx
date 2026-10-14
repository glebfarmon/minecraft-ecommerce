import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {AuditTable} from './audit-table'

const entry = (id: string, action: string, email: string | null) => ({
  id,
  actor: email ? {id: `u-${id}`, email} : null,
  action,
  entityType: 'admin',
  entityId: 'a1',
  before: {role: 'SUPPORT'},
  after: {role: 'ADMIN'},
  ip: '10.0.0.1',
  createdAt: '2026-10-12T09:30:00.000Z'
})

function mockApi() {
  return jest.spyOn(global, 'fetch').mockImplementation(input => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    if (url.searchParams.get('cursor') === 'c1')
      return Promise.resolve(
        Response.json({entries: [entry('3', 'role.deleted', 'bob@x.io')], nextCursor: null})
      )
    return Promise.resolve(
      Response.json({
        entries: [entry('1', 'admin.role_changed', 'ann@x.io'), entry('2', 'invite.created', null)],
        nextCursor: 'c1'
      })
    )
  })
}

function requestedUrls(fetchMock: jest.SpyInstance) {
  return (fetchMock.mock.calls as [unknown][]).map(
    ([r]) => new URL(r instanceof Request ? r.url : String(r))
  )
}

describe('AuditTable', () => {
  it('shows actor, action, entity and time for each entry', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    const row = (await screen.findByText('admin.role_changed')).closest('tr') as HTMLElement
    expect(row).toHaveTextContent('ann@x.io')
    expect(row).toHaveTextContent('admin a1')
    expect(row).toHaveTextContent('2026-10-12 09:30 UTC')
  })

  it('shows System when there is no actor', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    const row = (await screen.findByText('invite.created')).closest('tr') as HTMLElement
    expect(row).toHaveTextContent('System')
  })

  it('keeps before and after collapsed until opened', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    const row = (await screen.findByText('admin.role_changed')).closest('tr') as HTMLElement
    const details = row.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details).toHaveTextContent('"role": "ADMIN"')
  })

  it('loads the next page with the cursor', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AuditTable />)
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}))
    expect(await screen.findByText('role.deleted')).toBeInTheDocument()
    expect(screen.getByText('admin.role_changed')).toBeInTheDocument()
    expect(requestedUrls(fetchMock).some(u => u.searchParams.get('cursor') === 'c1')).toBe(true)
    expect(screen.queryByRole('button', {name: 'Load more'})).not.toBeInTheDocument()
  })

  it('filters by action prefix', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AuditTable />)
    await screen.findByText('admin.role_changed')
    fireEvent.change(screen.getByLabelText('Action starts with'), {target: {value: 'role.'}})
    fireEvent.click(screen.getByRole('button', {name: 'Apply filters'}))
    await waitFor(() => {
      expect(requestedUrls(fetchMock).some(u => u.searchParams.get('action') === 'role.')).toBe(
        true
      )
    })
  })

  it('filters by date range covering whole days in UTC', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AuditTable />)
    await screen.findByText('admin.role_changed')
    fireEvent.change(screen.getByLabelText('From'), {target: {value: '2026-10-01'}})
    fireEvent.change(screen.getByLabelText('To'), {target: {value: '2026-10-05'}})
    fireEvent.click(screen.getByRole('button', {name: 'Apply filters'}))
    await waitFor(() => {
      expect(
        requestedUrls(fetchMock).some(
          u =>
            u.searchParams.get('from') === '2026-10-01T00:00:00.000Z' &&
            u.searchParams.get('to') === '2026-10-05T23:59:59.999Z'
        )
      ).toBe(true)
    })
  })

  it('restarts from the first page when filters change', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}))
    await screen.findByText('role.deleted')
    fireEvent.change(screen.getByLabelText('Action starts with'), {target: {value: 'invite.'}})
    fireEvent.click(screen.getByRole('button', {name: 'Apply filters'}))
    await waitFor(() => {
      expect(screen.queryByText('role.deleted')).not.toBeInTheDocument()
    })
  })

  it('shows an error when the log cannot be loaded', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(Response.json({statusCode: 403, message: 'forbidden'}, {status: 403}))
    renderWithStore(<AuditTable />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission/)
  })
})
