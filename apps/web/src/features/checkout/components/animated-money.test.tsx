import {formatPrice} from '@/lib/catalog'
import {render, screen} from '@testing-library/react'

import {AnimatedMoney} from './animated-money'

let mockReduce = false
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  useReducedMotion: () => mockReduce
}))
jest.mock('next-intl', () => ({useLocale: () => 'en'}))

// Matchers collapse the formatter's no-break space; so does the expected text.
// Matchers collapse the formatter's no-break space, so the expected text does too.
const eur = (minor: number) => formatPrice(minor, 'EUR', 'en').replace(/\s+/g, ' ')

describe('AnimatedMoney', () => {
  beforeEach(() => {
    mockReduce = false
  })

  it('shows the formatted value on first render', () => {
    render(<AnimatedMoney minor={1000} currency="EUR" />)
    expect(screen.getByTestId('animated-money')).toHaveTextContent(eur(1000))
  })

  it('renders the final text at once under reduced motion', () => {
    mockReduce = true
    const {rerender} = render(<AnimatedMoney minor={1000} currency="EUR" />)
    rerender(<AnimatedMoney minor={860} currency="EUR" />)
    expect(screen.getByTestId('animated-money')).toHaveTextContent(eur(860))
  })

  it('rolls to the new value', async () => {
    const {rerender} = render(<AnimatedMoney minor={1000} currency="EUR" />)
    rerender(<AnimatedMoney minor={860} currency="EUR" />)
    expect(
      await screen.findByText(eur(860), {selector: '[aria-hidden="true"]'}, {timeout: 2000})
    ).toBeInTheDocument()
  })

  it('gives screen readers the final value in a polite live region when asked', () => {
    const {rerender} = render(<AnimatedMoney minor={1000} currency="EUR" live />)
    rerender(<AnimatedMoney minor={860} currency="EUR" live />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(eur(860))
  })

  it('has no live region by default, but keeps the final value readable', () => {
    render(<AnimatedMoney minor={1000} currency="EUR" />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(eur(1000), {selector: '.sr-only'})).toBeInTheDocument()
  })
})
