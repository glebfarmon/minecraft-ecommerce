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
    const en = screen.getByRole('radio', {name: 'English'})
    expect(screen.getByRole('radiogroup', {name: 'Language'})).toBeInTheDocument()
    expect(en).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', {name: 'Polski'})).toHaveAttribute('aria-checked', 'false')
    expect(en.querySelector('[data-slot="rolling-indicator"]')).toBeInTheDocument()
  })

  it('shows keyboard focus on a layer above the pill, not the accent', () => {
    renderWithProviders(<LanguageSwitch orientation="vertical" />)
    const cls = screen.getByRole('radio', {name: 'English'}).className
    expect(cls).not.toContain('ring-accent')
    expect(cls).toContain('focus-visible:after:z-10')
  })

  it('names itself in the chosen language', () => {
    renderWithProviders(<LanguageSwitch orientation="horizontal" />, {locale: 'pl'})
    expect(screen.getByRole('radiogroup', {name: 'Język'})).toBeInTheDocument()
    expect(screen.getByRole('radio', {name: 'Polski'})).toHaveAttribute('aria-checked', 'true')
  })

  it('writes the cookie and refreshes when PL is clicked', () => {
    renderWithProviders(<LanguageSwitch orientation="vertical" />)
    fireEvent.click(screen.getByRole('radio', {name: 'Polski'}))
    expect(document.cookie).toContain('admin_locale=pl')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when the active language is clicked again', () => {
    renderWithProviders(<LanguageSwitch orientation="vertical" />)
    fireEvent.click(screen.getByRole('radio', {name: 'English'}))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('is one tab stop and moves with the arrow keys', () => {
    renderWithProviders(<LanguageSwitch orientation="vertical" />)
    expect(screen.getByRole('radio', {name: 'English'})).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', {name: 'Polski'})).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(screen.getByRole('radio', {name: 'English'}), {key: 'ArrowRight'})
    expect(document.cookie).toContain('admin_locale=pl')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps a typed draft in a sibling field across the switch', async () => {
    renderWithProviders(
      <>
        <input aria-label="Draft" />
        <LanguageSwitch orientation="vertical" />
      </>
    )
    await userEvent.type(screen.getByLabelText('Draft'), 'half-written')
    await userEvent.click(screen.getByRole('radio', {name: 'Polski'}))
    expect(screen.getByLabelText('Draft')).toHaveValue('half-written')
  })
})
