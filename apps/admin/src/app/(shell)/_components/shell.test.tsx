import {renderWithProviders} from '@/test/render-with-providers'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

import type {Me} from '@shop/shared/access'

import {GlobalSearch} from './global-search'
import {MobileNav} from './mobile-nav'
import {Nav} from './nav'

const push = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => '/orders',
  useRouter: () => ({push, refresh: jest.fn()})
}))

const me = {
  id: 'u1',
  email: 'owner@shop.localhost',
  name: 'Owner',
  role: {id: 'r', name: 'OWNER'},
  permissions: ['order.read', 'audit.read', 'admin.invite', 'content.write']
} as unknown as Me

describe('shell', () => {
  it('rail links are named by label and mark the current page', () => {
    renderWithProviders(<Nav me={me} variant="rail" />, {store: false})
    const orders = screen.getByRole('link', {name: 'Orders'})
    expect(orders).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', {name: 'Audit log'})).toBeInTheDocument()
  })

  it('names the rail links in Polish', () => {
    renderWithProviders(<Nav me={me} variant="rail" />, {store: false, locale: 'pl'})
    expect(screen.getByRole('link', {name: 'Zamówienia'})).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation', {name: 'Panel'})).toBeInTheDocument()
  })

  it('hides entries the user lacks permission for', () => {
    renderWithProviders(<Nav me={{...me, permissions: []}} variant="rail" />, {store: false})
    expect(screen.queryByRole('link', {name: 'Orders'})).toBeNull()
    expect(screen.getByRole('link', {name: 'Catalog'})).toBeInTheDocument()
  })

  it('global search sends the query to the orders page', () => {
    renderWithProviders(<GlobalSearch />, {store: false})
    fireEvent.change(screen.getByLabelText('Search orders'), {target: {value: 'Steve 1'}})
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/orders?q=Steve%201')
  })

  it('mobile menu opens as a dialog with the nav and closes on navigate', async () => {
    renderWithProviders(<MobileNav me={me} />, {store: false})
    fireEvent.click(screen.getByRole('button', {name: 'Open menu'}))
    const dialog = screen.getByRole('dialog', {name: 'Menu'})
    fireEvent.click(within(dialog).getByRole('link', {name: 'Catalog'}))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
