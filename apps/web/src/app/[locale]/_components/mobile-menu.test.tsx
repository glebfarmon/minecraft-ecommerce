import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import type {ComponentProps} from 'react'

import {MobileMenu} from './mobile-menu'

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, {rich: (key: string) => key})
}))
jest.mock('@/i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />
}))
// The real options need the shop provider and router; they have their own tests.
jest.mock('@/features/settings/components/settings-menu', () => ({
  SettingsOptions: () => <div>settings-options</div>
}))
// jsdom never finishes the shared-layout exit; unmount at once.
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  AnimatePresence: ({children}: {children: React.ReactNode}) => children
}))

const links = [
  {href: '/', label: 'Home'},
  {href: '/cases', label: 'Cases'}
]

describe('MobileMenu', () => {
  it('starts collapsed behind a menu button', () => {
    render(<MobileMenu links={links} onLinkClick={jest.fn()} />)
    expect(screen.getByRole('button', {name: 'menu'})).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('lists the links and the settings when opened', () => {
    render(<MobileMenu links={links} onLinkClick={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', {name: 'menu'}))
    expect(screen.getByRole('dialog', {name: 'menu'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Cases'})).toHaveAttribute('href', '/cases')
    expect(screen.getByText('settings-options')).toBeInTheDocument()
  })

  it('forwards a link click and closes', async () => {
    const onLinkClick = jest.fn()
    render(<MobileMenu links={links} onLinkClick={onLinkClick} />)
    fireEvent.click(screen.getByRole('button', {name: 'menu'}))
    fireEvent.click(screen.getByRole('link', {name: 'Cases'}))
    expect(onLinkClick).toHaveBeenCalledWith(expect.anything(), '/cases')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
