import {renderWithProviders} from '@/test/render-with-providers'
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

import {Dashboard} from './dashboard'

const days = (n: number, eur: number) =>
  Array.from({length: n}, (_, i) => ({
    day: new Date(Date.UTC(2026, 9, 17 - (n - 1 - i))).toISOString().slice(0, 10),
    totalMinor: i === n - 1 ? eur : 0,
    paidCount: i === n - 1 ? 1 : 0
  }))

const stats = (over: Partial<Record<string, unknown>> = {}) => ({
  range: '7d',
  currency: 'EUR',
  from: '2026-10-11T00:00:00.000Z',
  to: '2026-10-17T12:00:00.000Z',
  revenueMinor: 1250,
  previousRevenueMinor: 1000,
  paidCount: 20,
  previousPaidCount: 0,
  averageMinor: 625,
  ltvMinor: 1800,
  buyers: 4,
  awaitingRate: 0,
  previousAwaitingRate: 0,
  expiredCount: 1,
  conversion: 0.5,
  byStatus: [
    {status: 'PAID', count: 1},
    {status: 'EXPIRED', count: 1}
  ],
  byCurrency: [
    {currency: 'EUR', count: 13, totalMinor: 123400},
    {currency: 'PLN', count: 7, totalMinor: 50000}
  ],
  daily: days(7, 1250),
  topProducts: [{productId: 'p1', name: 'VIP', serverName: 'Anarchy', quantity: 3}],
  ...over
})

/** Answers with `body`, or with `byCurrency(currency)` so a switch can be told from stale data. */
/** A KPI or chart card once the figures are in: the cards are on screen, titled, while they load. */
async function findCard(name: string) {
  await waitFor(() => {
    expect(screen.queryByText(STATS_LOADING)).not.toBeInTheDocument()
  })
  return screen.getByRole('region', {name})
}
const STATS_LOADING = /^(Loading statistics…|Wczytywanie statystyk…)$/

function mockApi(body: object | ((currency: string) => object)) {
  return jest.spyOn(global, 'fetch').mockImplementation(input => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    if (url.pathname.endsWith('/stats/orders'))
      return Promise.resolve(
        Response.json(
          typeof body === 'function'
            ? (body as (c: string) => object)(url.searchParams.get('currency') ?? 'EUR')
            : body
        )
      )
    return Promise.resolve(Response.json({orders: [], nextCursor: null}))
  })
}

const requestedUrls = (fetchMock: jest.SpyInstance) =>
  (fetchMock.mock.calls as [unknown][]).map(([r]) => String(r instanceof Request ? r.url : r))

beforeEach(() => {
  localStorage.clear()
})

describe('Dashboard', () => {
  it('speaks Polish', async () => {
    mockApi(stats())
    renderWithProviders(<Dashboard />, {locale: 'pl'})
    const revenue = await findCard('Przychód')
    expect(revenue).toHaveTextContent('12,50')
    expect(screen.getByRole('region', {name: 'Opłacone zamówienia'})).toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'Średnie zamówienie'})).toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'LTV'})).toHaveTextContent('4 kupujących')
  })

  it('shows revenue, paid orders, average order, conversion and LTV in one currency', async () => {
    mockApi(stats())
    renderWithStore(<Dashboard />)
    const revenue = await findCard('Revenue')
    expect(revenue).toHaveTextContent('€12.50')
    expect(revenue).toHaveTextContent('+25%')
    expect(screen.getByRole('region', {name: 'Paid orders'})).toHaveTextContent('20')
    expect(screen.getByRole('region', {name: 'Average order'})).toHaveTextContent('€6.25')
    expect(screen.getByRole('region', {name: 'Conversion'})).toHaveTextContent('50%')
    expect(screen.getByRole('region', {name: 'LTV'})).toHaveTextContent('€18.00')
    expect(screen.getByRole('region', {name: 'LTV'})).toHaveTextContent('4 buyers')
    expect(screen.queryByRole('region', {name: /Revenue (EUR|PLN)/})).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('region', {name: 'Top products'})).getByText('VIP')
    ).toBeInTheDocument()
    // The revenue card's sparkline and the chart.
    expect(screen.getAllByRole('img', {name: /Revenue per day/})).toHaveLength(2)
  })

  it('splits paid orders by original currency', async () => {
    mockApi(stats())
    renderWithStore(<Dashboard />)
    const donut = await screen.findByRole('img', {
      name: 'Paid orders by currency: EUR 13 (65%), PLN 7 (35%)'
    })
    expect(donut).toBeInTheDocument()
    expect(screen.getByText(/EUR 65% · 13 orders · €1,234\.00/)).toBeInTheDocument()
    expect(screen.getByText(/PLN 35% · 7 orders · PLN\s?500\.00|zł\s?500\.00/)).toBeInTheDocument()
  })

  it('refetches in PLN when the currency tab is switched and never shows EUR numbers as PLN', async () => {
    const fetchMock = mockApi((currency: string) =>
      stats({currency, revenueMinor: currency === 'PLN' ? 5375 : 1250})
    )
    renderWithStore(<Dashboard />)
    await findCard('Revenue')
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'PLN'}))
    fireEvent.click(screen.getByRole('tab', {name: 'PLN'}))
    await waitFor(() => {
      expect(screen.getByRole('region', {name: 'Revenue'})).toHaveTextContent(/53[,.]75/)
    })
    expect(screen.getByRole('region', {name: 'Revenue'})).not.toHaveTextContent('€')
    expect(requestedUrls(fetchMock).some(u => u.includes('currency=PLN'))).toBe(true)
  })

  it('shows the loading state, not the previous currency, while the switch is in flight', async () => {
    let release: () => void = () => undefined
    jest.spyOn(global, 'fetch').mockImplementation(input => {
      const url = new URL(String(input instanceof Request ? input.url : input))
      if (!url.pathname.endsWith('/stats/orders'))
        return Promise.resolve(Response.json({orders: [], nextCursor: null}))
      const currency = url.searchParams.get('currency') ?? 'EUR'
      if (currency === 'EUR') return Promise.resolve(Response.json(stats()))
      return new Promise(resolve => {
        release = () => {
          resolve(Response.json(stats({currency: 'PLN', revenueMinor: 5375})))
        }
      })
    })
    renderWithStore(<Dashboard />)
    await findCard('Revenue')
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'PLN'}))
    fireEvent.click(screen.getByRole('tab', {name: 'PLN'}))
    expect(await screen.findByText('Loading statistics…')).toBeInTheDocument()
    // The card stays in place as a placeholder; no euro figure sits under the PLN label.
    expect(screen.getByRole('region', {name: 'Revenue'})).not.toHaveTextContent('€')
    release()
    expect(await findCard('Revenue')).toBeInTheDocument()
  })

  it('remembers the chosen currency across a remount', async () => {
    mockApi((currency: string) => stats({currency}))
    const first = renderWithStore(<Dashboard />)
    await findCard('Revenue')
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'PLN'}))
    fireEvent.click(screen.getByRole('tab', {name: 'PLN'}))
    await waitFor(() => {
      expect(localStorage.getItem('admin.reportCurrency')).toBe('PLN')
    })
    first.unmount()
    const fetchMock = mockApi((currency: string) => stats({currency}))
    fetchMock.mockClear()
    renderWithStore(<Dashboard />)
    await findCard('Revenue')
    expect(
      requestedUrls(fetchMock).every(u => !u.includes('stats/orders') || u.includes('currency=PLN'))
    ).toBe(true)
    expect(screen.getByRole('tab', {name: 'PLN'})).toHaveAttribute('aria-selected', 'true')
  })

  it('hides the vs-previous delta when the previous period had orders without a rate', async () => {
    mockApi(stats({previousAwaitingRate: 1}))
    renderWithStore(<Dashboard />)
    const revenue = await findCard('Revenue')
    expect(revenue).toHaveTextContent('€12.50')
    expect(revenue).not.toHaveTextContent('+25%')
  })

  it('rolls an indicator on the currency tabs', async () => {
    mockApi(stats())
    renderWithStore(<Dashboard />)
    await findCard('Revenue')
    const tab = screen
      .getByRole('tablist', {name: 'Currency'})
      .querySelector('[aria-selected="true"] [data-slot="tabs-indicator"]')
    expect(tab).not.toBeNull()
  })

  it('shows dashes for average and LTV and a note while orders wait for a rate', async () => {
    mockApi(
      stats({
        revenueMinor: 0,
        previousRevenueMinor: 0,
        averageMinor: null,
        ltvMinor: null,
        buyers: 0,
        awaitingRate: 2
      })
    )
    renderWithStore(<Dashboard />)
    expect(await findCard('Average order')).toHaveTextContent('—')
    expect(screen.getByRole('region', {name: 'LTV'})).toHaveTextContent('—')
    expect(screen.getByText(/2 orders waiting for an exchange rate/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN/)
  })

  it('shows a dash, not €0.00 and −100%, when every paid order awaits a rate', async () => {
    mockApi(
      stats({
        revenueMinor: 0,
        previousRevenueMinor: 900,
        averageMinor: null,
        ltvMinor: null,
        buyers: 0,
        awaitingRate: 20
      })
    )
    renderWithStore(<Dashboard />)
    const revenue = await findCard('Revenue')
    expect(revenue).toHaveTextContent('—')
    expect(revenue).not.toHaveTextContent('€0.00')
    expect(revenue).not.toHaveTextContent('−100%')
  })

  it('hides the vs-previous delta while some orders await a rate', async () => {
    mockApi(stats({awaitingRate: 1}))
    renderWithStore(<Dashboard />)
    const revenue = await findCard('Revenue')
    expect(revenue).toHaveTextContent('€12.50')
    expect(revenue).not.toHaveTextContent('+25%')
  })

  it('shows dashes and empty states on an empty range instead of NaN', async () => {
    mockApi(
      stats({
        revenueMinor: 0,
        previousRevenueMinor: 0,
        paidCount: 0,
        averageMinor: null,
        ltvMinor: null,
        buyers: 0,
        expiredCount: 0,
        conversion: null,
        byStatus: [],
        byCurrency: [],
        daily: days(7, 0),
        topProducts: []
      })
    )
    renderWithStore(<Dashboard />)
    expect(await findCard('Conversion')).toHaveTextContent('—')
    expect(screen.getByText('No sales in this range.')).toBeInTheDocument()
    expect(screen.queryByText(/waiting for an exchange rate/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN/)
  })

  it('switches the range to 30 days', async () => {
    const fetchMock = mockApi(stats())
    renderWithStore(<Dashboard />)
    await findCard('Revenue')
    fireEvent.mouseDown(screen.getByRole('tab', {name: '30 days'}))
    fireEvent.click(screen.getByRole('tab', {name: '30 days'}))
    await findCard('Revenue')
    expect(requestedUrls(fetchMock).some(u => u.includes('range=30d'))).toBe(true)
  })

  it('keeps the previous range on screen, busy, while the other range loads', async () => {
    let release: () => void = () => undefined
    jest.spyOn(global, 'fetch').mockImplementation(input => {
      const url = new URL(String(input instanceof Request ? input.url : input))
      if (!url.pathname.endsWith('/stats/orders'))
        return Promise.resolve(Response.json({orders: [], nextCursor: null}))
      if (url.searchParams.get('range') === '7d') return Promise.resolve(Response.json(stats()))
      return new Promise(resolve => {
        release = () => {
          resolve(Response.json(stats({range: '30d', paidCount: 44})))
        }
      })
    })
    renderWithStore(<Dashboard />)
    const paid = await findCard('Paid orders')
    expect(paid).toHaveTextContent('20')
    fireEvent.mouseDown(screen.getByRole('tab', {name: '30 days'}))
    fireEvent.click(screen.getByRole('tab', {name: '30 days'}))
    await waitFor(() => {
      expect(
        screen.getByRole('region', {name: 'Paid orders'}).closest('[aria-busy]')
      ).toHaveAttribute('aria-busy', 'true')
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'Paid orders'})).toHaveTextContent('20')
    release()
    await waitFor(() => {
      expect(screen.getByRole('region', {name: 'Paid orders'})).toHaveTextContent('44')
    })
    expect(
      screen.getByRole('region', {name: 'Paid orders'}).closest('[aria-busy="true"]')
    ).toBeNull()
  })

  it('opens the order when the whole latest-orders row is clicked', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(input => {
      const url = new URL(String(input instanceof Request ? input.url : input))
      if (url.pathname.endsWith('/stats/orders')) return Promise.resolve(Response.json(stats()))
      return Promise.resolve(
        Response.json({
          orders: [
            {
              id: 'o1',
              publicId: 'ORD-1',
              nick: 'Steve',
              totalMinor: 500,
              currency: 'EUR',
              status: 'PAID'
            }
          ],
          nextCursor: null
        })
      )
    })
    renderWithStore(<Dashboard />)
    const nick = (await screen.findAllByText('Steve'))[0] as HTMLElement
    const link = screen.getAllByRole('link', {name: 'ORD-1'})[0] as HTMLAnchorElement
    expect(link).toHaveAttribute('href', '/orders/o1')
    const click = jest.fn((e: Event) => {
      e.preventDefault()
    })
    link.addEventListener('click', click)
    fireEvent.click(nick)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('offers a retry when statistics fail to load', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', {status: 500}))
    renderWithStore(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load statistics')
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument()
  })
})
