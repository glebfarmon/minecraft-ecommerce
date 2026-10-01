import AdminHomePage from '@/app/page'
import {render, screen} from '@testing-library/react'

describe('AdminHomePage', () => {
  it('renders the admin heading and sign-in button', () => {
    render(<AdminHomePage />)
    expect(screen.getByRole('heading', {level: 1, name: 'Shop Admin'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Sign in'})).toBeInTheDocument()
  })
})
