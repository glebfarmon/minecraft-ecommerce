import {ShopProvider} from '@/features/cart/shop-provider'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {SettingsMenu} from './settings-menu'

const mockReplace = jest.fn()
// next-intl and the routing config are ESM-only; keys stand in for translated text.
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))
jest.mock('@/i18n/navigation', () => ({
  usePathname: () => '/cases',
  useRouter: () => ({replace: mockReplace})
}))
jest.mock('@/i18n/routing', () => ({routing: {locales: ['en', 'pl']}}))
// jsdom never finishes the shared-layout exit; unmount at once.
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  AnimatePresence: ({children}: {children: React.ReactNode}) => children
}))

const setup = () =>
  render(
    <ShopProvider>
      <SettingsMenu />
    </ShopProvider>
  )
const trigger = () => screen.getByRole('button', {name: 'settings'})
const open = () => {
  fireEvent.click(trigger())
}

describe('SettingsMenu', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    localStorage.clear()
  })

  it('shows the current language and currency symbol on the trigger', () => {
    setup()
    expect(trigger()).toHaveTextContent('en')
    expect(trigger()).toHaveTextContent('€')
  })

  it('marks the current language and currency as checked', () => {
    setup()
    open()
    expect(screen.getByRole('radio', {name: /English/})).toBeChecked()
    expect(screen.getByRole('radio', {name: /Polski/})).not.toBeChecked()
    expect(screen.getByRole('radio', {name: /EUR/})).toBeChecked()
  })

  it('keeps the hash when switching the locale', () => {
    window.location.hash = '#r-2-3'
    setup()
    open()
    fireEvent.click(screen.getByRole('radio', {name: /Polski/}))
    expect(mockReplace).toHaveBeenCalledWith('/cases#r-2-3', {locale: 'pl', scroll: false})
    window.location.hash = ''
  })

  it('switches the locale in place and closes', async () => {
    setup()
    open()
    fireEvent.click(screen.getByRole('radio', {name: /Polski/}))
    expect(mockReplace).toHaveBeenCalledWith('/cases', {locale: 'pl', scroll: false})
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('switches the currency and closes', async () => {
    setup()
    open()
    fireEvent.click(screen.getByRole('radio', {name: /PLN/}))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(trigger()).toHaveTextContent('zł')
  })
})
