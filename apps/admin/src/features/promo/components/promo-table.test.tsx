import {renderWithStore} from '@/test/render-with-store'
import {findToast} from '@/test/toast'
import {screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {PromoTable} from './promo-table'

jest.mock('next/navigation', () => ({useRouter: () => ({push: jest.fn()})}))

const base = {
  kind: 'PERCENT',
  value: 15,
  currency: null,
  maxUses: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  status: 'active',
  locked: false,
  categoryIds: [],
  productIds: [],
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z'
}

const CODES = [
  {...base, id: 'p1', code: 'ASF14', usedCount: 3, version: 4},
  {
    ...base,
    id: 'p2',
    code: 'SPRING',
    kind: 'FIXED',
    value: 500,
    currency: 'EUR',
    maxUses: 100,
    usedCount: 2,
    startsAt: '2026-11-01T00:00:00.000Z',
    endsAt: '2026-11-30T23:59:00.000Z',
    status: 'scheduled'
  },
  {...base, id: 'p3', code: 'GONE', maxUses: 5, usedCount: 5, status: 'used_up'},
  {...base, id: 'p4', code: 'OLD', endsAt: '2026-01-31T00:00:00.000Z', status: 'expired'},
  {...base, id: 'p5', code: 'OFF', isActive: false, status: 'disabled'}
]

function mockApi() {
  const writes: {method: string; url: string; body: unknown}[] = []
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    if (req.method !== 'GET') {
      writes.push({method: req.method, url: req.url, body: await req.json().catch(() => null)})
      return Response.json({...CODES[0], isActive: false, status: 'disabled', version: 5})
    }
    return Response.json(CODES)
  })
  return writes
}

describe('PromoTable', () => {
  it('shows discount, uses with ∞ for unlimited, period and status labels', async () => {
    mockApi()
    renderWithStore(<PromoTable />)
    const table = await screen.findByRole('table', {name: 'Promo codes'})
    const row = (code: string) => within(table).getByText(code).closest('tr') as HTMLElement
    expect(within(row('ASF14')).getByText('15%')).toBeInTheDocument()
    expect(within(row('ASF14')).getByText('3 / ∞')).toBeInTheDocument()
    expect(within(row('ASF14')).getByText('Always')).toBeInTheDocument()
    expect(within(row('ASF14')).getByText('Active')).toBeInTheDocument()
    expect(within(row('SPRING')).getByText('€5.00')).toBeInTheDocument()
    expect(within(row('SPRING')).getByText('2 / 100')).toBeInTheDocument()
    expect(within(row('SPRING')).getByText('Scheduled')).toBeInTheDocument()
    expect(within(row('SPRING')).getByText('Nov 1, 2026 – Nov 30, 2026')).toBeInTheDocument()
    expect(within(row('GONE')).getByText('Used up')).toBeInTheDocument()
    expect(within(row('OLD')).getByText('Expired')).toBeInTheDocument()
    expect(within(row('OLD')).getByText(/Until/)).toBeInTheDocument()
    expect(within(row('OFF')).getByText('Disabled')).toBeInTheDocument()
    expect(within(row('ASF14')).getByRole('link', {name: 'ASF14'})).toHaveAttribute(
      'href',
      '/promo-codes/p1'
    )
  })

  it('disables a code from its menu with the version it was listed at', async () => {
    const writes = mockApi()
    const user = userEvent.setup()
    renderWithStore(<PromoTable />)
    const table = await screen.findByRole('table', {name: 'Promo codes'})
    await user.click(within(table).getByRole('button', {name: 'Actions for ASF14'}))
    await user.click(await screen.findByRole('menuitem', {name: 'Disable'}))
    await waitFor(() => {
      expect(writes).toHaveLength(1)
    })
    expect(writes[0]?.url).toMatch(/\/api\/admin\/promo-codes\/p1\/active$/)
    expect(writes[0]?.body).toEqual({isActive: false, version: 4})
    expect(await findToast()).toHaveTextContent('Code disabled.')
  })

  it('deletes only after a confirmation', async () => {
    const writes = mockApi()
    const user = userEvent.setup()
    renderWithStore(<PromoTable />)
    const table = await screen.findByRole('table', {name: 'Promo codes'})
    await user.click(within(table).getByRole('button', {name: 'Actions for OFF'}))
    await user.click(await screen.findByRole('menuitem', {name: 'Delete'}))
    expect(writes).toHaveLength(0)
    await user.click(screen.getByRole('button', {name: 'Confirm delete'}))
    await waitFor(() => {
      expect(writes[0]?.method).toBe('DELETE')
    })
    expect(writes[0]?.url).toMatch(/promo-codes\/p5\?version=1$/)
  })

  it('shows an empty state without codes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([]))
    renderWithStore(<PromoTable />)
    expect(await screen.findByText('No promo codes yet.')).toBeInTheDocument()
  })
})
