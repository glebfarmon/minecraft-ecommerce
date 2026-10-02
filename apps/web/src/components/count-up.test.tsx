import {render, screen} from '@testing-library/react'

import {CountUp} from './count-up'

let mockReduce = false
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  useReducedMotion: () => mockReduce
}))

describe('CountUp', () => {
  beforeEach(() => {
    mockReduce = false
  })

  it('shows the starting value on first render', () => {
    render(<CountUp value={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('counts up to a new value', async () => {
    const {rerender} = render(<CountUp value={0} />)
    rerender(<CountUp value={67} />)
    expect(await screen.findByText('67', undefined, {timeout: 3000})).toBeInTheDocument()
  })

  it('jumps straight to the value with reduced motion', async () => {
    mockReduce = true
    const {rerender} = render(<CountUp value={0} />)
    rerender(<CountUp value={67} />)
    expect(await screen.findByText('67', undefined, {timeout: 200})).toBeInTheDocument()
  })

  it('formats the shown number and honors a custom duration', async () => {
    const format = (n: number) => `${String(n)} PLN`
    const {rerender} = render(<CountUp value={0} format={format} duration={0.2} />)
    expect(screen.getByText('0 PLN')).toBeInTheDocument()
    rerender(<CountUp value={5} format={format} duration={0.2} />)
    expect(await screen.findByText('5 PLN', undefined, {timeout: 1000})).toBeInTheDocument()
  })
})
