import {renderWithProviders} from '@/test/render-with-providers'
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {OrdersTable} from './orders-table'

jest.mock('next/navigation', () => ({useRouter: () => ({push: jest.fn()})}))

const order = (id: string, status: string) => ({
  id,
  publicId: `SHOP-${id}`,
  createdAt: '2026-10-12T09:30:00.000Z',
  nick: `nick-${id}`,
  email: `${id}@x.io`,
  currency: 'EUR',
  totalMinor: 1250,
  status
})

function mockApi() {
  return jest.spyOn(global, 'fetch').mockImplementation(input => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    if (url.searchParams.get('cursor') === 'c1')
      return Promise.resolve(Response.json({orders: [order('o3', 'EXPIRED')], nextCursor: null}))
    return Promise.resolve(
      Response.json({orders: [order('o1', 'PAID'), order('o2', 'PENDING')], nextCursor: 'c1'})
    )
  })
}

function requestedUrls(fetchMock: jest.SpyInstance) {
  return (fetchMock.mock.calls as [unknown][]).map(
    ([r]) => new URL(r instanceof Request ? r.url : String(r))
  )
}

describe('OrdersTable', () => {
  it('speaks Polish: tabs, headers and status labels', async () => {
    mockApi()
    renderWithProviders(<OrdersTable />, {locale: 'pl'})
    expect(screen.getByRole('tab', {name: 'Opłacone'})).toBeInTheDocument()
    const table = await screen.findByRole('table', {name: 'Zamówienia'})
    expect(within(table).getByRole('columnheader', {name: 'Status'})).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', {name: 'Suma'})).toBeInTheDocument()
    const row = within(table).getByRole('link', {name: 'SHOP-o1'}).closest('tr') as HTMLElement
    expect(row).toHaveTextContent('Opłacone')
    expect(row).toHaveTextContent('12 paź 2026, 09:30 UTC')
  })

  it('shows each order with date, link, nick, email, money and status', async () => {
    mockApi()
    renderWithStore(<OrdersTable />)
    const table = await screen.findByRole('table', {name: 'Orders'})
    const link = within(table).getByRole('link', {name: 'SHOP-o1'})
    expect(link).toHaveAttribute('href', '/orders/o1')
    const row = link.closest('tr') as HTMLElement
    expect(row.className).toMatch(/cursor-pointer/)
    expect(row).toHaveTextContent('2026-10-12 09:30 UTC')
    expect(row).toHaveTextContent('nick-o1')
    expect(row).toHaveTextContent('o1@x.io')
    expect(row).toHaveTextContent('€12.50')
    expect(row).toHaveTextContent('Paid')
  })

  it('searches with q on submit', async () => {
    const fetchMock = mockApi()
    renderWithStore(<OrdersTable />)
    await screen.findByRole('table', {name: 'Orders'})
    fireEvent.change(screen.getByLabelText('Search by nick, email or order number'), {
      target: {value: 'steve'}
    })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() => {
      expect(requestedUrls(fetchMock).some(u => u.searchParams.get('q') === 'steve')).toBe(true)
    })
  })

  it('filters by the status tab', async () => {
    const fetchMock = mockApi()
    renderWithStore(<OrdersTable />)
    await screen.findAllByText('SHOP-o1')
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'Expired'}))
    fireEvent.click(screen.getByRole('tab', {name: 'Expired'}))
    await waitFor(() => {
      expect(requestedUrls(fetchMock).some(u => u.searchParams.get('status') === 'EXPIRED')).toBe(
        true
      )
    })
  })

  it('starts with the query from the URL', async () => {
    const fetchMock = mockApi()
    renderWithStore(<OrdersTable initialQ="steve" />)
    expect(screen.getByLabelText('Search by nick, email or order number')).toHaveValue('steve')
    await waitFor(() => {
      expect(requestedUrls(fetchMock).some(u => u.searchParams.get('q') === 'steve')).toBe(true)
    })
  })

  it('copies the order number from the row menu', async () => {
    mockApi()
    // userEvent.setup() installs its own clipboard stub, so spy on it afterwards.
    const user = userEvent.setup()
    const writeText = jest.spyOn(navigator.clipboard, 'writeText')
    renderWithStore(<OrdersTable />)
    const table = await screen.findByRole('table', {name: 'Orders'})
    await user.click(within(table).getByRole('button', {name: 'Actions for SHOP-o1'}))
    await user.click(await screen.findByRole('menuitem', {name: 'Copy order number'}))
    expect(writeText).toHaveBeenCalledWith('SHOP-o1')
  })

  it('loads more with the cursor', async () => {
    const fetchMock = mockApi()
    renderWithStore(<OrdersTable />)
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}))
    expect((await screen.findAllByText('SHOP-o3')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('SHOP-o1').length).toBeGreaterThan(0)
    expect(requestedUrls(fetchMock).some(u => u.searchParams.get('cursor') === 'c1')).toBe(true)
  })

  it('shows a permission message on 403', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(Response.json({statusCode: 403, message: 'forbidden'}, {status: 403}))
    renderWithStore(<OrdersTable />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to read orders.'
    )
  })

  it('shows an empty state', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({orders: [], nextCursor: null}))
    renderWithStore(<OrdersTable />)
    expect(await screen.findByText('No orders found.')).toBeInTheDocument()
  })
})
