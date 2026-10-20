import {renderWithProviders} from '@/test/render-with-providers'
import {screen} from '@testing-library/react'

import AuthLayout from './layout'

jest.mock('next/navigation', () => ({useRouter: () => ({refresh: jest.fn()})}))

describe('AuthLayout', () => {
  it('offers the language switch before anyone has signed in', () => {
    renderWithProviders(<AuthLayout>sign-in</AuthLayout>, {store: false, locale: 'pl'})
    expect(screen.getByText('sign-in')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', {name: 'Język'})).toBeInTheDocument()
  })
})
