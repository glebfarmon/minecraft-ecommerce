import {render, screen} from '@testing-library/react'

import {ScrollFade} from './scroll-fade'

function mockWidths(scrollWidth: number, clientWidth: number) {
  jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth)
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth)
}

describe('ScrollFade', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('fades the end when content overflows', () => {
    mockWidths(500, 200)
    render(
      <ScrollFade>
        <span>a</span>
      </ScrollFade>
    )
    const root = screen.getByText('a').parentElement
    expect(root).toHaveAttribute('data-fade-start', 'false')
    expect(root).toHaveAttribute('data-fade-end', 'true')
  })

  it('shows no fade when content fits', () => {
    mockWidths(200, 200)
    render(
      <ScrollFade>
        <span>a</span>
      </ScrollFade>
    )
    const root = screen.getByText('a').parentElement
    expect(root).toHaveAttribute('data-fade-start', 'false')
    expect(root).toHaveAttribute('data-fade-end', 'false')
  })

  it('merges a custom class', () => {
    render(
      <ScrollFade className="gap-2">
        <span>a</span>
      </ScrollFade>
    )
    expect(screen.getByText('a').parentElement).toHaveClass('scroll-fade-x', 'gap-2')
  })
})
