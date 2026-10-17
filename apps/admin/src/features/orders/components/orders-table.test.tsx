import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {ORDER_STATUSES} from '@shop/shared/orders'

import {OrdersTable} from './orders-table'

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
  it('shows each order with date, link, nick, email, money and status', async () => {
    mockApi()
    renderWithStore(<OrdersTable />)
    const link = await screen.findByRole('link', {name: 'SHOP-o1'})
    expect(link).toHaveAttribute('href', '/orders/o1')
    const row = link.closest('tr') as HTMLElement
    expect(row).toHaveTextContent('2026-10-12 09:30 UTC')
    expect(row).toHaveTextContent('nick-o1')
    expect(row).toHaveTextContent('o1@x.io')
    expect(row).toHaveTextContent('€12.50')
    expect(row).toHaveTextContent('PAID')
  })

  it('searches with q on submit', async () => {
    const fetchMock = mockApi()
    renderWithStore(<OrdersTable />)
    await screen.findByText('SHOP-o1')
    fireEvent.change(screen.getByLabelText('Search by nick, email or order number'), {
      target: {value: 'steve'}
    })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() => {
      expect(requestedUrls(fetchMock).some(u => u.searchParams.get('q') === 'steve')).toBe(true)
    })
  })

  it('filters by status', async () => {
    const fetchMock = mockApi()
    renderWithStore(<OrdersTable />)
    await screen.findByText('SHOP-o1')
    const select = screen.getByLabelText<HTMLSelectElement>('Status')
    expect(Array.from(select.options).map(o => o.text)).toEqual(['All', ...ORDER_STATUSES])
    fireEvent.change(select, {target: {value: 'PAID'}})
    await waitFor(() => {
      expect(requestedUrls(fetchMock).some(u => u.searchParams.get('status') === 'PAID')).toBe(true)
    })
  })

  it('loads more with the cursor', async () => {
    const fetchMock = mockApi()
    renderWithStore(<OrdersTable />)
    fireEvent.click(await screen.findByRole('button', {name: 'Load more'}))
    expect(await screen.findByText('SHOP-o3')).toBeInTheDocument()
    expect(screen.getByText('SHOP-o1')).toBeInTheDocument()
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
