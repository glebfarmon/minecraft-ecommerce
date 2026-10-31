import {renderWithStore} from '@/test/render-with-store'
import {screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {DeliveriesTable} from './deliveries-table'

const row = (over: object) => ({
  id: 'd1',
  kind: 'GRANT',
  status: 'FAILED',
  serverName: 'Survival',
  productName: 'VIP',
  commands: ['say hi'],
  commandsDone: 0,
  attempts: 4,
  nextAttemptAt: '2026-10-12T09:30:00.000Z',
  lastError: 'timeout',
  replies: [],
  createdAt: '2026-10-12T09:30:00.000Z',
  nick: 'Alex',
  orderId: 'o1',
  orderPublicId: 'SHOP-1',
  ...over
})

const ROWS = [
  row({}),
  row({
    id: 'd2',
    kind: 'REVOKE',
    status: 'NEEDS_REVIEW',
    nick: 'Gone',
    orderId: null,
    orderPublicId: null,
    productName: null,
    lastError: null
  })
]

function mockApi(deliveries: object[] = ROWS) {
  const writes: {method: string; url: string}[] = []
  jest.spyOn(global, 'fetch').mockImplementation(input => {
    const req = input instanceof Request ? input : new Request(String(input))
    if (req.method !== 'GET') {
      writes.push({method: req.method, url: new URL(req.url).pathname})
      return Promise.resolve(Response.json(ROWS[0]))
    }
    return Promise.resolve(
      Response.json({deliveries, nextCursor: null, attentionCount: deliveries.length})
    )
  })
  return writes
}

describe('DeliveriesTable', () => {
  it('lists kind, nick, server, product, status, attempts, last error and the order link', async () => {
    mockApi()
    renderWithStore(<DeliveriesTable canResolve />)
    const table = await screen.findByRole('table', {name: 'Deliveries'})
    const first = within(table).getByText('Alex').closest('tr') as HTMLElement
    expect(within(first).getByText('Grant')).toBeInTheDocument()
    expect(within(first).getByText('Survival')).toBeInTheDocument()
    expect(within(first).getByText('VIP')).toBeInTheDocument()
    expect(within(first).getByText('Failed')).toBeInTheDocument()
    expect(within(first).getByText('4')).toBeInTheDocument()
    expect(within(first).getByText('timeout')).toBeInTheDocument()
    expect(within(first).getByRole('link', {name: 'SHOP-1'})).toHaveAttribute('href', '/orders/o1')
    const second = within(table).getByText('Gone').closest('tr') as HTMLElement
    expect(within(second).getByText('Revoke')).toBeInTheDocument()
    expect(within(second).getByText('Needs review')).toBeInTheDocument()
    expect(within(second).queryByRole('link')).not.toBeInTheDocument()
    expect(within(second).getByText('No order (expiry)')).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    mockApi([])
    renderWithStore(<DeliveriesTable canResolve />)
    expect(await screen.findByText('No stuck deliveries.')).toBeInTheDocument()
  })

  it('hides Retry and Mark as done without delivery.resolve', async () => {
    mockApi()
    renderWithStore(<DeliveriesTable canResolve={false} />)
    await screen.findByRole('table', {name: 'Deliveries'})
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Mark as done'})).not.toBeInTheDocument()
  })

  it('retries a FAILED delivery at once', async () => {
    const writes = mockApi()
    renderWithStore(<DeliveriesTable canResolve />)
    const table = await screen.findByRole('table', {name: 'Deliveries'})
    const first = within(table).getByText('Alex').closest('tr') as HTMLElement
    await userEvent.click(within(first).getByRole('button', {name: 'Retry'}))
    await waitFor(() => {
      expect(writes).toEqual([{method: 'POST', url: '/api/admin/deliveries/d1/retry'}])
    })
  })

  it('asks before retrying a NEEDS_REVIEW delivery', async () => {
    const writes = mockApi()
    renderWithStore(<DeliveriesTable canResolve />)
    const table = await screen.findByRole('table', {name: 'Deliveries'})
    const second = within(table).getByText('Gone').closest('tr') as HTMLElement
    await userEvent.click(within(second).getByRole('button', {name: 'Retry'}))
    expect(within(second).getByText(/run it twice/)).toBeInTheDocument()
    expect(writes).toEqual([])
    await userEvent.click(within(second).getByRole('button', {name: 'Retry anyway'}))
    await waitFor(() => {
      expect(writes).toEqual([{method: 'POST', url: '/api/admin/deliveries/d2/retry'}])
    })
  })
})
