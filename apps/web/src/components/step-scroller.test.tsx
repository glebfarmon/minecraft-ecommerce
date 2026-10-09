import {fireEvent, render, screen} from '@testing-library/react'

import {StepScroller} from './step-scroller'

function renderScroller(activeKey: string, onPrev = jest.fn(), onNext = jest.fn()) {
  return render(
    <StepScroller
      label="Things"
      prevLabel="Previous thing"
      nextLabel="Next thing"
      onPrev={onPrev}
      onNext={onNext}
      activeKey={activeKey}>
      <button type="button" aria-pressed={activeKey === 'a'}>
        A
      </button>
      <button type="button" aria-pressed={activeKey === 'b'}>
        B
      </button>
    </StepScroller>
  )
}

describe('StepScroller', () => {
  it('groups the content under its label', () => {
    renderScroller('a')
    expect(screen.getByRole('group', {name: 'Things'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'A'})).toBeInTheDocument()
  })

  it('calls onPrev and onNext from the arrows', () => {
    const onPrev = jest.fn()
    const onNext = jest.fn()
    renderScroller('a', onPrev, onNext)
    fireEvent.click(screen.getByRole('button', {name: 'Previous thing'}))
    fireEvent.click(screen.getByRole('button', {name: 'Next thing'}))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('scrolls only the row to centre the pressed child when the active key changes', () => {
    const scrollBy = jest.spyOn(Element.prototype, 'scrollBy')
    const scrollIntoView = jest.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const rect = (left: number, width: number) => ({left, width}) as DOMRect
    const {rerender, container} = renderScroller('a')
    const row = container.querySelector('.scroll-fade-x')
    if (!row) throw new Error('no scroll row')
    jest.spyOn(row, 'getBoundingClientRect').mockReturnValue(rect(100, 200)) // centre 200
    scrollBy.mockClear()
    rerender(
      <StepScroller
        label="Things"
        prevLabel="Previous thing"
        nextLabel="Next thing"
        onPrev={jest.fn()}
        onNext={jest.fn()}
        activeKey="b">
        <button type="button" aria-pressed={false}>
          A
        </button>
        <button type="button" aria-pressed>
          B
        </button>
      </StepScroller>
    )
    jest
      .spyOn(screen.getByRole('button', {name: 'B'}), 'getBoundingClientRect')
      .mockReturnValue(rect(260, 40)) // centre 280
    // The effect already ran with zero-sized rects; trigger it again for the measured layout.
    rerender(
      <StepScroller
        label="Things"
        prevLabel="Previous thing"
        nextLabel="Next thing"
        onPrev={jest.fn()}
        onNext={jest.fn()}
        activeKey="c">
        <button type="button" aria-pressed={false}>
          A
        </button>
        <button type="button" aria-pressed>
          B
        </button>
      </StepScroller>
    )
    expect(scrollBy).toHaveBeenLastCalledWith({left: 80})
    // scrollIntoView would also scroll the page when the row is below the fold.
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
