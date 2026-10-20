import {render, screen} from '@testing-library/react'

import {Donut} from './donut'

describe('Donut', () => {
  it('labels the ring and draws one segment per non-zero value', () => {
    const view = render(
      <Donut
        label="Things: a 2, b 0"
        segments={[
          {key: 'a', value: 2, className: 'stroke-ok'},
          {key: 'b', value: 0, className: 'stroke-bad'}
        ]}
        centre={<text>2</text>}
      />
    )
    expect(screen.getByRole('img', {name: 'Things: a 2, b 0'})).toBeInTheDocument()
    // The track plus the single non-zero segment.
    expect(view.container.querySelectorAll('circle')).toHaveLength(2)
    expect(view.container.querySelector('.stroke-bad')).toBeNull()
  })
})
