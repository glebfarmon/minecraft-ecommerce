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
})
