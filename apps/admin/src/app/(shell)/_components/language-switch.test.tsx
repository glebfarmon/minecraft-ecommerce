import {renderWithProviders} from '@/test/render-with-providers'
import {fireEvent, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {LanguageSwitch} from './language-switch'

const refresh = jest.fn()
jest.mock('next/navigation', () => ({useRouter: () => ({refresh})}))

describe('LanguageSwitch', () => {
  beforeEach(() => {
    refresh.mockClear()
    document.cookie = 'admin_locale=; max-age=0; path=/'
  })

  it('marks the active language and holds the rolling indicator there', () => {
    renderWithProviders(<LanguageSwitch orientation="vertical" />)
    const en = screen.getByRole('radio', {name: 'EN'})
    expect(screen.getByRole('radiogroup', {name: 'Language'})).toBeInTheDocument()
    expect(en).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', {name: 'PL'})).toHaveAttribute('aria-checked', 'false')
    expect(en.querySelector('[data-slot="rolling-indicator"]')).toBeInTheDocument()
  })

  it('names itself in the chosen language', () => {
    renderWithProviders(<LanguageSwitch orientation="horizontal" />, {locale: 'pl'})
    expect(screen.getByRole('radiogroup', {name: 'Język'})).toBeInTheDocument()
    expect(screen.getByRole('radio', {name: 'PL'})).toHaveAttribute('aria-checked', 'true')
  })

  it('writes the cookie and refreshes when PL is clicked', () => {
    renderWithProviders(<LanguageSwitch orientation="vertical" />)
    fireEvent.click(screen.getByRole('radio', {name: 'PL'}))
    expect(document.cookie).toContain('admin_locale=pl')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when the active language is clicked again', () => {
    renderWithProviders(<LanguageSwitch orientation="vertical" />)
    fireEvent.click(screen.getByRole('radio', {name: 'EN'}))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps a typed draft in a sibling field across the switch', async () => {
    renderWithProviders(
      <>
        <input aria-label="Draft" />
        <LanguageSwitch orientation="vertical" />
      </>
    )
    await userEvent.type(screen.getByLabelText('Draft'), 'half-written')
    await userEvent.click(screen.getByRole('radio', {name: 'PL'}))
    expect(screen.getByLabelText('Draft')).toHaveValue('half-written')
  })
})
