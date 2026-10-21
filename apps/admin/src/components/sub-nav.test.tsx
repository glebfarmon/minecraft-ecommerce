import {fireEvent, render, screen} from '@testing-library/react'

import {SubNav} from './sub-nav'

let mockPath = '/content/rules'
jest.mock('next/navigation', () => ({usePathname: () => mockPath}))

const CONTENT = [
  {href: '/content/rules', label: 'Rules'},
  {href: '/content/texts', label: 'Texts'},
  {href: '/content/settings', label: 'Settings'}
]
const CATALOG = [
  {href: '/catalog', label: 'Products'},
  {href: '/catalog/categories', label: 'Categories'}
]

const current = () => screen.getByRole('link', {current: 'page'})

describe('SubNav', () => {
  beforeEach(() => {
    mockPath = '/content/rules'
  })

  it('marks the clicked item current before the path changes', () => {
    render(<SubNav label="Content" items={CONTENT} />)
    expect(current()).toHaveTextContent('Rules')
    fireEvent.click(screen.getByRole('link', {name: 'Texts'}))
    expect(current()).toHaveTextContent('Texts')
    fireEvent.click(screen.getByRole('link', {name: 'Settings'}))
    expect(current()).toHaveTextContent('Settings')
  })

  it('follows the path when it changes (Back)', () => {
    const {rerender} = render(<SubNav label="Content" items={CONTENT} />)
    fireEvent.click(screen.getByRole('link', {name: 'Texts'}))
    mockPath = '/content/settings'
    rerender(<SubNav label="Content" items={CONTENT} />)
    expect(current()).toHaveTextContent('Settings')
  })

  it('ignores ctrl-click', () => {
    render(<SubNav label="Content" items={CONTENT} />)
    fireEvent.click(screen.getByRole('link', {name: 'Texts'}), {ctrlKey: true})
    expect(current()).toHaveTextContent('Rules')
  })

  it('/catalog/categories marks Categories, not Products', () => {
    mockPath = '/catalog/categories'
    render(<SubNav label="Catalog" items={CATALOG} />)
    expect(current()).toHaveTextContent('Categories')
    expect(screen.getByRole('navigation', {name: 'Catalog'})).toBeInTheDocument()
  })

  it('/catalog marks Products', () => {
    mockPath = '/catalog'
    render(<SubNav label="Catalog" items={CATALOG} />)
    expect(current()).toHaveTextContent('Products')
  })

  it('pill links show keyboard focus without the accent ring', () => {
    render(<SubNav label="Content" items={CONTENT} />)
    const cls = screen.getByRole('link', {name: 'Texts'}).className
    expect(cls).not.toContain('ring-accent')
    expect(cls).toContain('focus-visible:ring-fg/25')
  })
})
