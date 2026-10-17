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
  publicId: 'ABCDEFGHJK',
  status: 'PAID',
  nick: 'Steve',
  email: 'a***@example.com',
  currency: 'EUR',
  totalMinor: 1500,
  servers: [
    {serverName: 'Survival', items: [{productName: 'VIP', quantity: 1, unitAmountMinor: 1000}]},
    {serverName: 'Skyblock', items: [{productName: 'Coins', quantity: 2, unitAmountMinor: 250}]}
  ],
  createdAt: '2026-10-16T10:00:00.000Z',
  paidAt: null
}
const pending: PublicOrder = {...base, status: 'PENDING'}

const fetchMock = jest.fn()
beforeEach(() => {
  jest.useFakeTimers()
  fetchMock.mockReset()
  ;(clearCart as jest.Mock).mockClear()
  global.fetch = fetchMock
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
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/ABCDEFGHJK', expect.anything())
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
})
