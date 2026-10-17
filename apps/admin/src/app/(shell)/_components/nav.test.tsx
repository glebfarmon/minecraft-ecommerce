import {render, screen} from '@testing-library/react'

import {Nav} from './nav'

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
  it('shows only sections the admin may open', () => {
    render(<Nav me={me(['admin.invite'])} />)
    expect(screen.getByRole('link', {name: 'Team'})).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', {name: 'Audit log'})).not.toBeInTheDocument()
  })
  it('shows the audit log with audit.read', () => {
    render(<Nav me={me(['audit.read'])} />)
    expect(screen.getByRole('link', {name: 'Audit log'})).toBeInTheDocument()
  })
  it('shows the catalog to every admin', () => {
    render(<Nav me={me([])} />)
    expect(screen.getByRole('link', {name: 'Catalog'})).toBeInTheDocument()
  })
  it('shows Content with content.write and marks it for its sub-pages', () => {
    mockPath = '/content/texts'
    render(<Nav me={me(['content.write'])} />)
    expect(screen.getByRole('link', {name: 'Content'})).toHaveAttribute('aria-current', 'page')
    mockPath = '/team'
  })
  it('hides Content without content.write', () => {
    render(<Nav me={me([])} />)
    expect(screen.queryByRole('link', {name: 'Content'})).not.toBeInTheDocument()
  })
  it('shows Orders with order.read', () => {
    render(<Nav me={me(['order.read'])} />)
    expect(screen.getByRole('link', {name: 'Orders'})).toBeInTheDocument()
  })
  it('hides Orders without order.read', () => {
    render(<Nav me={me([])} />)
    expect(screen.queryByRole('link', {name: 'Orders'})).not.toBeInTheDocument()
  })
})
