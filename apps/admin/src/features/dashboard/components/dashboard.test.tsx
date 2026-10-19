import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, within} from '@testing-library/react'

import {Dashboard} from './dashboard'

const days = (n: number, eur: number) =>
  Array.from({length: n}, (_, i) => {
    const day = new Date(Date.UTC(2026, 9, 17 - (n - 1 - i))).toISOString().slice(0, 10)
    return [
      {day, currency: 'EUR', totalMinor: i === n - 1 ? eur : 0, paidCount: i === n - 1 ? 1 : 0},
      {day, currency: 'PLN', totalMinor: 0, paidCount: 0}
    ]
  }).flat()

const stats = (over: Partial<Record<string, unknown>> = {}) => ({
  range: '7d',
  from: '2026-10-11T00:00:00.000Z',
  to: '2026-10-17T12:00:00.000Z',
  revenue: [
    {currency: 'EUR', totalMinor: 1250, previousMinor: 1000},
    {currency: 'PLN', totalMinor: 0, previousMinor: 0}
  ],
  paidCount: 1,
  previousPaidCount: 0,
  expiredCount: 1,
  conversion: 0.5,
  byStatus: [
    {status: 'PAID', count: 1},
    {status: 'EXPIRED', count: 1}
  ],
  daily: days(7, 1250),
  topProducts: [{productId: 'p1', name: 'VIP', serverName: 'Anarchy', quantity: 3}],
  ...over
})

function mockApi(body: unknown) {
  return jest.spyOn(global, 'fetch').mockImplementation(input => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    if (url.pathname.endsWith('/stats/orders')) return Promise.resolve(Response.json(body))
    return Promise.resolve(Response.json({orders: [], nextCursor: null}))
  })
}

describe('Dashboard', () => {
  it('shows revenue, paid orders, conversion and top products', async () => {
    mockApi(stats())
    renderWithStore(<Dashboard />)
    expect(await screen.findByRole('region', {name: 'Revenue EUR'})).toHaveTextContent('€12.50')
    expect(screen.getByRole('region', {name: 'Revenue EUR'})).toHaveTextContent('+25%')
    expect(screen.getByRole('region', {name: 'Conversion'})).toHaveTextContent('50%')
    expect(
      within(screen.getByRole('region', {name: 'Top products'})).getByText('VIP')
    ).toBeInTheDocument()
    expect(screen.getByRole('img', {name: /Revenue per day/})).toBeInTheDocument()
  })

  it('shows dashes and empty states on an empty range instead of NaN', async () => {
    mockApi(
      stats({
        revenue: [
          {currency: 'EUR', totalMinor: 0, previousMinor: 0},
          {currency: 'PLN', totalMinor: 0, previousMinor: 0}
        ],
        paidCount: 0,
        expiredCount: 0,
        conversion: null,
        byStatus: [],
        daily: days(7, 0),
        topProducts: []
      })
    )
    renderWithStore(<Dashboard />)
    expect(await screen.findByRole('region', {name: 'Conversion'})).toHaveTextContent('—')
    expect(screen.getByText('No sales in this range.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN/)
  })

  it('switches the range to 30 days', async () => {
    const fetchMock = mockApi(stats())
    renderWithStore(<Dashboard />)
    await screen.findByRole('region', {name: 'Revenue EUR'})
    fireEvent.mouseDown(screen.getByRole('tab', {name: '30 days'}))
    fireEvent.click(screen.getByRole('tab', {name: '30 days'}))
    await screen.findByRole('region', {name: 'Revenue EUR'})
    const urls = (fetchMock.mock.calls as [unknown][]).map(([r]) =>
      String(r instanceof Request ? r.url : r)
    )
    expect(urls.some(u => u.includes('range=30d'))).toBe(true)
  })

  it('offers a retry when statistics fail to load', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', {status: 500}))
    renderWithStore(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load statistics')
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument()
  })
})
