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
})
