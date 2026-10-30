import {PENDING_ORDER_KEY} from '@/config/order'
import {clearCart} from '@/features/order/lib/clear-cart'
import {act, render, screen} from '@testing-library/react'

import type {PublicOrder} from '@shop/shared/orders'

import {OrderStatus} from './order-status'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => `order.${key}`
}))
jest.mock('next/navigation', () => ({useRouter: () => ({refresh: jest.fn()})}))
jest.mock('@/i18n/navigation', () => ({
  Link: ({href, children}: {href: string; children: React.ReactNode}) => (
    <a href={href}>{children}</a>
  )
}))
jest.mock('@/features/order/lib/clear-cart', () => ({clearCart: jest.fn()}))

const base: PublicOrder = {
  publicId: 'ABCDEFGHJKLMNOPQRSTUVW',
  status: 'PAID',
  nick: 'Steve',
  email: 'a***@example.com',
  currency: 'EUR',
  subtotalMinor: 1500,
  discountMinor: 0,
  promoCode: null,
  totalMinor: 1500,
  servers: [
    {serverName: 'Survival', items: [{productName: 'VIP', quantity: 1, unitAmountMinor: 1000}]},
    {serverName: 'Skyblock', items: [{productName: 'Coins', quantity: 2, unitAmountMinor: 250}]}
  ],
  createdAt: '2026-10-16T10:00:00.000Z',
  paidAt: null,
  delivery: 'none'
}
const pending: PublicOrder = {...base, status: 'PENDING'}

const fetchMock = jest.fn()
beforeEach(() => {
  jest.useFakeTimers()
  fetchMock.mockReset()
  ;(clearCart as jest.Mock).mockClear()
  global.fetch = fetchMock
  localStorage.clear()
  localStorage.setItem(PENDING_ORDER_KEY, base.publicId)
})
afterEach(() => jest.useRealTimers())

const respond = (order: PublicOrder) =>
  fetchMock.mockResolvedValue({ok: true, status: 200, json: () => Promise.resolve(order)})
const tick = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms))

describe('OrderStatus', () => {
  it('shows a paid order grouped by server and clears the cart once', () => {
    const {rerender} = render(<OrderStatus initial={{...base}} />)
    expect(screen.getByRole('heading', {name: 'order.paid.title'})).toBeInTheDocument()
    expect(screen.getByText('Survival')).toBeInTheDocument()
    expect(screen.getByText('Skyblock')).toBeInTheDocument()
    expect(screen.getByText(/15[.,]00/)).toBeInTheDocument()
    rerender(<OrderStatus initial={{...base}} />)
    expect(clearCart).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('polls a pending order until it is paid', async () => {
    render(<OrderStatus initial={pending} />)
    expect(screen.getByRole('heading', {name: 'order.pending.title'})).toBeInTheDocument()
    expect(clearCart).not.toHaveBeenCalled()
    respond({...base})
    await tick(2000)
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/ABCDEFGHJKLMNOPQRSTUVW', expect.anything())
    expect(screen.getByRole('heading', {name: 'order.paid.title'})).toBeInTheDocument()
    expect(clearCart).toHaveBeenCalledTimes(1)
    await tick(10_000)
    expect(clearCart).toHaveBeenCalledTimes(1)
  })

  it('stops after the limit and says the payment is slow', async () => {
    respond(pending)
    render(<OrderStatus initial={pending} />)
    await tick(60_000)
    expect(screen.getByText('order.pending.slow')).toBeInTheDocument()
    const calls = fetchMock.mock.calls.length
    await tick(20_000)
    expect(fetchMock.mock.calls.length).toBe(calls)
  })

  it('removes the stored id once the cart is cleared', () => {
    render(<OrderStatus initial={{...base}} />)
    expect(localStorage.getItem(PENDING_ORDER_KEY)).toBeNull()
  })

  it.each([
    ['no stored id', null],
    ['another order id', 'ZZZZZZZZZZZZZZZZZZZZZZ']
  ])('keeps the cart of a paid order with %%s', (_name, stored) => {
    localStorage.clear()
    if (stored) localStorage.setItem(PENDING_ORDER_KEY, stored)
    render(<OrderStatus initial={{...base}} />)
    expect(clearCart).not.toHaveBeenCalled()
  })

  it('does not crash or clear when storage throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    render(<OrderStatus initial={{...base}} />)
    expect(screen.getByRole('heading', {name: 'order.paid.title'})).toBeInTheDocument()
    expect(clearCart).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('treats DELIVERED as paid and clears the cart', () => {
    render(<OrderStatus initial={{...base, status: 'DELIVERED'}} />)
    expect(screen.getByRole('heading', {name: 'order.paid.title'})).toBeInTheDocument()
    expect(clearCart).toHaveBeenCalledTimes(1)
  })

  it.each(['REFUNDED', 'DISPUTED'] as const)('shows a closed view for %%s', status => {
    render(<OrderStatus initial={{...base, status}} />)
    expect(screen.getByRole('heading', {name: 'order.closed.title'})).toBeInTheDocument()
    expect(screen.getByText('order.closed.body')).toBeInTheDocument()
    expect(clearCart).not.toHaveBeenCalled()
  })

  it('shows an expired order with a link home and keeps the cart', () => {
    render(<OrderStatus initial={{...base, status: 'EXPIRED'}} />)
    expect(screen.getByRole('heading', {name: 'order.expired.title'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'order.expired.back'})).toHaveAttribute('href', '/')
    expect(clearCart).not.toHaveBeenCalled()
  })

  it('survives failing polls and keeps going until the limit', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<OrderStatus initial={pending} />)
    await tick(10_000)
    expect(fetchMock.mock.calls.length).toBeGreaterThan(2)
    expect(screen.getByRole('heading', {name: 'order.pending.title'})).toBeInTheDocument()
    await tick(60_000)
    expect(screen.getByText('order.pending.slow')).toBeInTheDocument()
  })

  it('shows the promo row with the minus amount only when discounted', () => {
    const {unmount} = render(<OrderStatus initial={{...base}} />)
    expect(screen.queryByText(/order\.promo/)).not.toBeInTheDocument()
    unmount()
    render(
      <OrderStatus
        initial={{
          ...base,
          subtotalMinor: 1500,
          discountMinor: 240,
          promoCode: 'ASF14',
          totalMinor: 1260
        }}
      />
    )
    expect(screen.getByText('order.promo')).toBeInTheDocument()
    expect(screen.getByText(/^\u22122\.40\s€$/)).toBeInTheDocument()
  })

  describe('delivery', () => {
    const delivering: PublicOrder = {...base, delivery: 'delivering'}

    it('shows "being delivered" and polls every 3 s', async () => {
      respond(delivering)
      render(<OrderStatus initial={delivering} />)
      expect(screen.getByText('order.delivery.delivering')).toBeInTheDocument()
      await tick(3000)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/orders/ABCDEFGHJKLMNOPQRSTUVW',
        expect.anything()
      )
      await tick(3000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('switches to "delivered" and stops polling', async () => {
      respond({...base, delivery: 'delivered'})
      render(<OrderStatus initial={delivering} />)
      await tick(3000)
      expect(screen.getByText('order.delivery.delivered')).toBeInTheDocument()
      expect(screen.queryByText('order.delivery.delivering')).not.toBeInTheDocument()
      await tick(30_000)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('shows "delayed" without any error detail and keeps polling', async () => {
      respond({...base, delivery: 'delayed'})
      render(<OrderStatus initial={delivering} />)
      await tick(3000)
      expect(screen.getByText('order.delivery.delayed')).toBeInTheDocument()
      expect(screen.queryByText(/rcon|error/i)).not.toBeInTheDocument()
      await tick(6000)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('stops after 10 minutes with the later line', async () => {
      respond({...base, delivery: 'delayed'})
      render(<OrderStatus initial={{...base, delivery: 'delayed'}} />)
      await tick(600_000)
      expect(screen.getByText('order.delivery.later')).toBeInTheDocument()
      const calls = fetchMock.mock.calls.length
      await tick(30_000)
      expect(fetchMock.mock.calls.length).toBe(calls)
    })

    it('does not poll for delivery none', async () => {
      render(<OrderStatus initial={{...base}} />)
      await tick(30_000)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(screen.queryByText(/order\.delivery\./)).not.toBeInTheDocument()
    })

    it('does not poll once the order is DELIVERED', async () => {
      render(<OrderStatus initial={{...base, status: 'DELIVERED', delivery: 'delivered'}} />)
      expect(screen.getByText('order.delivery.delivered')).toBeInTheDocument()
      await tick(30_000)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
