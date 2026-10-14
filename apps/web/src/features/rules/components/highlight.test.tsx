import {render} from '@testing-library/react'

import {Highlight} from './highlight'

describe('Highlight', () => {
  it('wraps every match in <mark>, keeping the original letters', () => {
    const {container} = render(<Highlight text="Żółw i żółw" query="zolw" locale="pl" />)
    const marks = [...container.querySelectorAll('mark')].map(m => m.textContent)
    expect(marks).toEqual(['Żółw', 'żółw'])
    expect(container).toHaveTextContent('Żółw i żółw')
  })

  it('renders plain text without a query', () => {
    const {container} = render(<Highlight text="No spam" query="" locale="en" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container).toHaveTextContent('No spam')
  })

  it('draws a fresh mark for a new query, so its highlight sweep plays again', () => {
    const {container, rerender} = render(<Highlight text="No spam" query="spa" locale="en" />)
    const first = container.querySelector('mark')
    rerender(<Highlight text="No spam" query="spam" locale="en" />)
    const second = container.querySelector('mark')
    expect(first).not.toBeNull()
    expect(second).not.toBe(first)
    expect(second).toHaveClass('animate-mark-in')
  })
})
