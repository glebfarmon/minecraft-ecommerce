import {render, screen} from '@testing-library/react'

import {Nav} from './nav'

jest.mock('next/navigation', () => ({usePathname: () => '/team'}))

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
})
