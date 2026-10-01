import {render, screen} from '@testing-library/react'

import AdminHomePage from './page'

describe('AdminHomePage', () => {
  it('renders the admin heading and sign-in button', () => {
    render(<AdminHomePage />)
    expect(screen.getByRole('heading', {level: 1, name: 'Shop Admin'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Sign in'})).toBeInTheDocument()
  })
})
