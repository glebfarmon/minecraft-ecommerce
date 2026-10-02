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

  it('scrolls the pressed child into view when the active key changes', () => {
    const scrollIntoView = jest.spyOn(Element.prototype, 'scrollIntoView')
    const {rerender} = renderScroller('a')
    scrollIntoView.mockClear()
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
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('button', {name: 'B'}))
  })
})
