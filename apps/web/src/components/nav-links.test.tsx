import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import type {ComponentProps} from 'react'

import {NavLinks} from './nav-links'

// The real Link needs the next-intl router; a plain anchor is enough to test hover state.
jest.mock('@/i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />
}))

const links = [
  {href: '/', label: 'Home'},
  {href: '/cases', label: 'Cases'},
  {href: '/rules', label: 'Rules'}
]

const pills = () => document.querySelectorAll('[data-nav-pill]')
const pillIn = (name: string) => screen.getByRole('link', {name}).querySelector('[data-nav-pill]')

describe('NavLinks', () => {
  it('shows no pill until a link is hovered', () => {
    render(<NavLinks links={links} onLinkClick={jest.fn()} />)
    expect(pills()).toHaveLength(0)
  })

  it('shows the pill behind the hovered link', () => {
    render(<NavLinks links={links} onLinkClick={jest.fn()} />)
    fireEvent.mouseEnter(screen.getByRole('link', {name: 'Cases'}))
    expect(pillIn('Cases')).not.toBeNull()
    expect(pillIn('Cases')).toHaveAttribute('aria-hidden', 'true')
  })

  // jsdom has no layout, so Motion never finishes the crossfade that removes the old pill;
  // e2e/tests/navbar.spec.ts checks that it settles to a single pill.
  it('moves the pill to the next hovered link', () => {
    render(<NavLinks links={links} onLinkClick={jest.fn()} />)
    fireEvent.mouseEnter(screen.getByRole('link', {name: 'Cases'}))
    fireEvent.mouseEnter(screen.getByRole('link', {name: 'Rules'}))
    expect(pillIn('Rules')).not.toBeNull()
  })

  it('removes the pill when the cursor leaves the list', async () => {
    render(<NavLinks links={links} onLinkClick={jest.fn()} />)
    fireEvent.mouseEnter(screen.getByRole('link', {name: 'Cases'}))
    fireEvent.mouseLeave(screen.getByRole('list'))
    await waitFor(() => {
      expect(pills()).toHaveLength(0)
    })
  })

  it('forwards clicks with the link href', () => {
    const onLinkClick = jest.fn()
    render(<NavLinks links={links} onLinkClick={onLinkClick} />)
    fireEvent.click(screen.getByRole('link', {name: 'Rules'}))
    expect(onLinkClick).toHaveBeenCalledWith(expect.anything(), '/rules')
  })
})
