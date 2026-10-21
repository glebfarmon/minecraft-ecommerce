import {renderWithProviders} from '@/test/render-with-providers'
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

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
    if (url.pathname.endsWith('/admin/admins'))
      return Promise.resolve(
        Response.json([
          {
            id: 'u-ann',
            email: 'ann@x.io',
            name: 'Ann',
            role: {id: 'r', name: 'ADMIN'},
            twoFactorEnabled: true,
            disabledAt: null
          },
          {
            id: 'u-bob',
            email: 'bob@x.io',
            name: 'Bob',
            role: {id: 'r', name: 'ADMIN'},
            twoFactorEnabled: true,
            disabledAt: null
          }
        ])
      )
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

/** The desktop table row holding `text` (the mobile list repeats it). */
async function rowOf(text: string) {
  const hits = await screen.findAllByText(text)
  return hits.map(h => h.closest('tr')).find(Boolean) as HTMLElement
}

describe('AuditTable', () => {
  it('speaks Polish in the headers while the entries stay as logged', async () => {
    mockApi()
    renderWithProviders(<AuditTable />, {locale: 'pl'})
    const row = await rowOf('admin.role_changed')
    const table = row.closest('table') as HTMLElement
    expect(within(table).getByRole('columnheader', {name: 'Akcja'})).toBeInTheDocument()
    expect(row).toHaveTextContent('ann@x.io')
    expect(row).toHaveTextContent('12 paź 2026, 09:30 UTC')
  })

  it('shows actor, action, entity and time for each entry', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    const row = await rowOf('admin.role_changed')
    expect(row).toHaveTextContent('ann@x.io')
    expect(row).toHaveTextContent('admin a1')
    expect(row).toHaveTextContent('2026-10-12 09:30 UTC')
  })

  it('shows System when there is no actor', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    const row = await rowOf('invite.created')
    expect(row).toHaveTextContent('System')
  })

  it('keeps before and after collapsed until opened', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    const row = await rowOf('admin.role_changed')
    const details = row.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details).toHaveTextContent('"role": "ADMIN"')
  })

  it('pages forward and back', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AuditTable />)
    await screen.findAllByText('admin.role_changed')
    expect(screen.getByText('Page 1')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Previous page'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: 'Next page'}))
    expect((await screen.findAllByText('role.deleted')).length).toBeGreaterThan(0)
    expect(screen.queryAllByText('admin.role_changed')).toHaveLength(0)
    expect(screen.getByText('Page 2')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Next page'})).toBeDisabled()
    expect(requestedUrls(fetchMock).some(u => u.searchParams.get('cursor') === 'c1')).toBe(true)
    const calls = requestedUrls(fetchMock).length
    fireEvent.click(screen.getByRole('button', {name: 'Previous page'}))
    expect((await screen.findAllByText('admin.role_changed')).length).toBeGreaterThan(0)
    expect(screen.getByText('Page 1')).toBeInTheDocument()
    expect(requestedUrls(fetchMock)).toHaveLength(calls)
  })

  it('filters by actor', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AuditTable />)
    await screen.findAllByText('admin.role_changed')
    fireEvent.click(screen.getByRole('combobox', {name: 'Actor'}))
    expect(await screen.findByRole('option', {name: 'Anyone'})).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('option', {name: 'bob@x.io'}))
    fireEvent.click(screen.getByRole('button', {name: 'Apply filters'}))
    await waitFor(() => {
      expect(requestedUrls(fetchMock).some(u => u.searchParams.get('actorId') === 'u-bob')).toBe(
        true
      )
    })
    expect(
      requestedUrls(fetchMock)
        .filter(u => u.pathname.endsWith('/admin/audit'))
        .some(u => u.searchParams.has('actorId') && u.searchParams.get('actorId') === '')
    ).toBe(false)
  })

  it('filters by action prefix', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AuditTable />)
    await screen.findAllByText('admin.role_changed')
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
    await screen.findAllByText('admin.role_changed')
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

  it('resets to page 1 when filters change', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    fireEvent.click(await screen.findByRole('button', {name: 'Next page'}))
    await screen.findAllByText('role.deleted')
    fireEvent.change(screen.getByLabelText('Action starts with'), {target: {value: 'invite.'}})
    fireEvent.click(screen.getByRole('button', {name: 'Apply filters'}))
    await waitFor(() => {
      expect(screen.queryAllByText('role.deleted')).toHaveLength(0)
    })
    expect(await screen.findByText('Page 1')).toBeInTheDocument()
  })

  it('shows an error when the log cannot be loaded', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(Response.json({statusCode: 403, message: 'forbidden'}, {status: 403}))
    renderWithStore(<AuditTable />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission/)
  })

  it('shows the entries as a list on narrow screens', async () => {
    mockApi()
    renderWithStore(<AuditTable />)
    const list = await screen.findByRole('list', {name: 'Audit log'})
    expect(list).toHaveTextContent('admin.role_changed')
  })

  it('says when nothing is logged', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({entries: [], nextCursor: null}))
    renderWithStore(<AuditTable />)
    expect(await screen.findByText('Nothing logged yet.')).toBeInTheDocument()
  })
})
