import {render, screen} from '@testing-library/react'
import {NextIntlClientProvider} from 'next-intl'
import {createTranslator} from 'next-intl'

import en from '../../../../messages/en.json'
import pl from '../../../../messages/pl.json'
import LoginPage from './page'

let mockLocale: 'en' | 'pl' = 'pl'
jest.mock('next-intl/server', () => ({
  getTranslations: (namespace: string) =>
    Promise.resolve(
      createTranslator({
        locale: mockLocale,
        messages: mockLocale === 'pl' ? pl : en,
        namespace
      } as never)
    )
}))
jest.mock('@/lib/auth-client', () => ({authClient: {signIn: {}, emailOtp: {}}}))
jest.mock('@/lib/session', () => ({getMe: () => Promise.resolve({state: 'signed-out'})}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
  useRouter: () => ({push: jest.fn(), replace: jest.fn()})
}))

async function renderPage() {
  render(
    <NextIntlClientProvider locale={mockLocale} messages={mockLocale === 'pl' ? pl : en}>
      {await LoginPage()}
    </NextIntlClientProvider>
  )
}

describe('LoginPage', () => {
  it('is outside the shell and still follows the language of the cookie', async () => {
    mockLocale = 'pl'
    await renderPage()
    expect(screen.getByRole('heading', {name: 'Zaloguj się do panelu'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Wyślij kod'})).toBeInTheDocument()
  })

  it('reads English by default', async () => {
    mockLocale = 'en'
    await renderPage()
    expect(screen.getByRole('heading', {name: 'Sign in to Shop Admin'})).toBeInTheDocument()
  })
})
