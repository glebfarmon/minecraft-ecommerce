import {renderWithIntl} from '@/test/render-with-providers'
import {fireEvent, screen} from '@testing-library/react'
import type {ReactElement} from 'react'

import {TooltipProvider} from '@shop/ui/tooltip'

import {Nav} from './nav'

const render = (ui: ReactElement) => renderWithIntl(<TooltipProvider>{ui}</TooltipProvider>)

let mockPath = '/team'
jest.mock('next/navigation', () => ({usePathname: () => mockPath}))

const me = (permissions: string[]) =>
  ({
    id: 'u',
    email: 'a@x.io',
    name: 'A',
    role: {id: 'r', name: 'X', isSystem: false, permissions},
    permissions
  }) as never

describe('Nav', () => {
  beforeEach(() => {
    mockPath = '/team'
  })
  it('shows only sections the admin may open', () => {
    render(<Nav me={me(['admin.invite'])} variant="rail" />)
    expect(screen.getByRole('link', {name: 'Team'})).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', {name: 'Audit log'})).not.toBeInTheDocument()
  })
  it('shows the audit log with audit.read', () => {
    render(<Nav me={me(['audit.read'])} variant="rail" />)
    expect(screen.getByRole('link', {name: 'Audit log'})).toBeInTheDocument()
  })
  it('shows the catalog to every admin', () => {
    render(<Nav me={me([])} variant="rail" />)
    expect(screen.getByRole('link', {name: 'Catalog'})).toBeInTheDocument()
  })
  it('shows Content with content.write and marks it for its sub-pages', () => {
    mockPath = '/content/texts'
    render(<Nav me={me(['content.write'])} variant="rail" />)
    expect(screen.getByRole('link', {name: 'Content'})).toHaveAttribute('aria-current', 'page')
    mockPath = '/team'
  })
  it('the current rail link contains the rolling indicator', () => {
    render(<Nav me={me(['admin.invite'])} variant="rail" />)
    const team = screen.getByRole('link', {name: 'Team'})
    expect(team.querySelector('[data-slot=rolling-indicator]')).not.toBeNull()
    expect(document.querySelectorAll('[data-slot=rolling-indicator]')).toHaveLength(1)
  })
  it('rail links carry no native title', () => {
    render(<Nav me={me([])} variant="rail" />)
    expect(screen.getByRole('link', {name: 'Catalog'})).not.toHaveAttribute('title')
  })
  it('hides Content without content.write', () => {
    render(<Nav me={me([])} variant="rail" />)
    expect(screen.queryByRole('link', {name: 'Content'})).not.toBeInTheDocument()
  })
  it('shows Orders with order.read', () => {
    render(<Nav me={me(['order.read'])} variant="rail" />)
    expect(screen.getByRole('link', {name: 'Orders'})).toBeInTheDocument()
  })
  it('hides Orders without order.read', () => {
    render(<Nav me={me([])} variant="rail" />)
    expect(screen.queryByRole('link', {name: 'Orders'})).not.toBeInTheDocument()
  })
  it('shows Promo codes with promo.write only', () => {
    render(<Nav me={me(['promo.write'])} variant="rail" />)
    expect(screen.getByRole('link', {name: 'Promo codes'})).toHaveAttribute('href', '/promo-codes')
  })
  it('hides Promo codes without promo.write', () => {
    render(<Nav me={me([])} variant="rail" />)
    expect(screen.queryByRole('link', {name: 'Promo codes'})).not.toBeInTheDocument()
  })
  it('rail links show keyboard focus without the accent ring', () => {
    render(<Nav me={me([])} variant="rail" />)
    const cls = screen.getByRole('link', {name: 'Catalog'}).className
    expect(cls).not.toContain('ring-accent')
    expect(cls).toContain('focus-visible:after:z-10')
    expect(cls).toContain('focus-visible:after:ring-fg/40')
  })
  it('a click moves the current mark and the indicator before the path changes', () => {
    mockPath = '/'
    render(<Nav me={me(['order.read'])} variant="rail" />)
    const orders = screen.getByRole('link', {name: 'Orders'})
    fireEvent.click(orders)
    expect(orders).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', {name: 'Home'})).not.toHaveAttribute('aria-current')
    expect(orders.querySelector('[data-slot=rolling-indicator]')).not.toBeNull()
    expect(document.querySelectorAll('[data-slot=rolling-indicator]')).toHaveLength(1)
  })
  it('a click still calls onNavigate (the sheet closes)', () => {
    const onNavigate = jest.fn()
    render(<Nav me={me([])} variant="sheet" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('link', {name: 'Catalog'}))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })
  it('a ctrl-click leaves the current mark where it is', () => {
    mockPath = '/'
    render(<Nav me={me(['order.read'])} variant="rail" />)
    fireEvent.click(screen.getByRole('link', {name: 'Orders'}), {ctrlKey: true})
    expect(screen.getByRole('link', {name: 'Home'})).toHaveAttribute('aria-current', 'page')
  })
  it('sheet links use the same focus layer', () => {
    render(<Nav me={me([])} variant="sheet" />)
    const cls = screen.getByRole('link', {name: 'Catalog'}).className
    expect(cls).not.toContain('ring-accent')
    expect(cls).toContain('focus-visible:after:z-10')
  })
})
