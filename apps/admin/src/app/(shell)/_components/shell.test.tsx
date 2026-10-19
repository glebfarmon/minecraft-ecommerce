import {fireEvent, render, screen, within} from '@testing-library/react'

import type {Me} from '@shop/shared/access'
import {TooltipProvider} from '@shop/ui/tooltip'

import {GlobalSearch} from './global-search'
import {MobileNav} from './mobile-nav'
import {Nav} from './nav'

const push = jest.fn()
jest.mock('next/navigation', () => ({usePathname: () => '/orders', useRouter: () => ({push})}))

const me = {
  id: 'u1',
  email: 'owner@shop.localhost',
  name: 'Owner',
  role: {id: 'r', name: 'OWNER'},
  permissions: ['order.read', 'audit.read', 'admin.invite', 'content.write']
} as unknown as Me

describe('shell', () => {
  it('rail links are named by label and mark the current page', () => {
    render(<Nav me={me} variant="rail" />, {wrapper: TooltipProvider})
    const orders = screen.getByRole('link', {name: 'Orders'})
    expect(orders).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', {name: 'Audit log'})).toBeInTheDocument()
  })

  it('hides entries the user lacks permission for', () => {
    render(<Nav me={{...me, permissions: []}} variant="rail" />, {wrapper: TooltipProvider})
    expect(screen.queryByRole('link', {name: 'Orders'})).toBeNull()
    expect(screen.getByRole('link', {name: 'Catalog'})).toBeInTheDocument()
  })

  it('global search sends the query to the orders page', () => {
    render(<GlobalSearch />)
    fireEvent.change(screen.getByLabelText('Search orders'), {target: {value: 'Steve 1'}})
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/orders?q=Steve%201')
  })

  it('mobile menu opens as a dialog with the nav and closes on navigate', () => {
    render(<MobileNav me={me} />)
    fireEvent.click(screen.getByRole('button', {name: 'Open menu'}))
    const dialog = screen.getByRole('dialog', {name: 'Menu'})
    fireEvent.click(within(dialog).getByRole('link', {name: 'Catalog'}))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
