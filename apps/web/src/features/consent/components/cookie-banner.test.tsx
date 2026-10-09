import {fireEvent, render, screen} from '@testing-library/react'

import {CookieBanner} from './cookie-banner'

// next-intl is ESM-only; keys stand in for translated text.
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))
// jsdom never finishes the exit animation; unmount at once.
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  AnimatePresence: ({children}: {children: React.ReactNode}) => children
}))

const banner = () => screen.queryByRole('region', {name: 'label'})

beforeEach(() => {
  document.cookie = 'cookie_consent=; max-age=0; path=/'
})

describe('CookieBanner', () => {
  it('necessary cookies are fixed on, analytics is off by default', () => {
    render(<CookieBanner />)
    expect(screen.getByRole('checkbox', {name: 'necessary'})).toBeDisabled()
    expect(screen.getByRole('checkbox', {name: 'necessary'})).toBeChecked()
    expect(screen.getByRole('checkbox', {name: 'analytics'})).not.toBeChecked()
  })

  it('saving with the default selection stores "necessary"', () => {
    render(<CookieBanner />)
    fireEvent.click(screen.getByRole('button', {name: 'save'}))
    expect(document.cookie).toContain('cookie_consent=necessary')
    expect(banner()).not.toBeInTheDocument()
  })

  it('saving with analytics ticked stores "all"', () => {
    render(<CookieBanner />)
    fireEvent.click(screen.getByRole('checkbox', {name: 'analytics'}))
    fireEvent.click(screen.getByRole('button', {name: 'save'}))
    expect(document.cookie).toContain('cookie_consent=all')
  })

  it('accept all stores "all"', () => {
    render(<CookieBanner />)
    fireEvent.click(screen.getByRole('button', {name: 'acceptAll'}))
    expect(document.cookie).toContain('cookie_consent=all')
    expect(banner()).not.toBeInTheDocument()
  })

  it('stays hidden when the cookie is already set', () => {
    document.cookie = 'cookie_consent=necessary; path=/'
    render(<CookieBanner />)
    expect(banner()).not.toBeInTheDocument()
  })
})
