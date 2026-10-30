import {renderWithIntl} from '@/test/render-with-providers'
import {act, fireEvent, screen} from '@testing-library/react'

import {TooltipProvider} from '@shop/ui/tooltip'

import {CodeDice} from './code-dice'

const CODE = /^[A-HJ-NP-Z]{5}[2-9]{3}$/

/** A seeded generator, so the frames are the same on every run. */
function seeded(seed = 7) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
}

describe('CodeDice', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('hands over a valid code at once when motion is reduced', () => {
    mockReducedMotion(true)
    const onCode = jest.fn()
    renderWithIntl(
      <TooltipProvider>
        <CodeDice onCode={onCode} />
      </TooltipProvider>
    )
    fireEvent.click(screen.getByRole('button', {name: 'Generate a code'}))
    expect(onCode).toHaveBeenCalledTimes(1)
    expect(onCode.mock.calls[0]?.[0]).toMatch(CODE)
    expect(onCode.mock.calls[0]?.[1]).toBe(true)
  })

  it('flips from the placeholder and settles on a valid code within ~600 ms', () => {
    mockReducedMotion(false)
    jest.useFakeTimers()
    const onCode = jest.fn()
    renderWithIntl(
      <TooltipProvider>
        <CodeDice onCode={onCode} random={seeded()} />
      </TooltipProvider>
    )
    fireEvent.click(screen.getByRole('button', {name: 'Generate a code'}))
    expect(onCode).toHaveBeenNthCalledWith(1, 'AAAAA000', false)
    act(() => {
      jest.advanceTimersByTime(700)
    })
    const calls = onCode.mock.calls as [string, boolean][]
    expect(calls.length).toBeGreaterThan(5)
    const last = calls.at(-1)
    expect(last?.[1]).toBe(true)
    expect(last?.[0]).toMatch(CODE)
    // Slots settle left to right: the frame from which each slot keeps its final character.
    const final = last?.[0] ?? ''
    const settled = Array.from({length: 8}, (_, slot) => {
      let i = calls.length - 1
      while (i > 0 && calls[i - 1]?.[0][slot] === final[slot]) i--
      return i
    })
    expect(settled).toEqual([...settled].sort((a, b) => a - b))
    expect(settled[0]).toBeLessThan(settled[7] ?? 0)
    expect(calls.filter(([, done]) => done)).toHaveLength(1)
  })
})
