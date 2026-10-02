import {fireEvent, render, screen} from '@testing-library/react'

import {Catalog} from './catalog'

let mockLocale = 'en'
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => key
}))
// next-intl/navigation is ESM-only in jest; this mirrors its `as-needed` rule (default locale `en` has no prefix).
jest.mock('@/i18n/navigation', () => ({
  getPathname: ({locale, href}: {locale: string; href: string}) =>
    locale === 'en' ? href : `/${locale}${href}`
}))
// The product cards need the shop provider; the URL logic under test does not.
jest.mock('@/features/catalog/components/product-card', () => ({ProductCard: () => null}))

describe('Catalog server switcher', () => {
  let pushState: jest.SpyInstance

  beforeEach(() => {
    pushState = jest.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
  })
  afterEach(() => {
    pushState.mockRestore()
  })

  it('leaves the default locale unprefixed', () => {
    mockLocale = 'en'
    render(<Catalog initialServer="survival" />)
    fireEvent.click(screen.getByRole('button', {name: 'Anarchy'}))
    expect(pushState).toHaveBeenCalledWith(null, '', '/anarchy')
  })

  it('prefixes other locales', () => {
    mockLocale = 'pl'
    render(<Catalog initialServer="survival" />)
    fireEvent.click(screen.getByRole('button', {name: 'Anarchy'}))
    expect(pushState).toHaveBeenCalledWith(null, '', '/pl/anarchy')
  })
})
