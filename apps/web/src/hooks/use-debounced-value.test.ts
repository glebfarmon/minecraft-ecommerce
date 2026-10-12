import {act, renderHook} from '@testing-library/react'

import {useDebouncedValue} from './use-debounced-value'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns the value only after it has been stable for the delay', () => {
    const {result, rerender} = renderHook(({value}) => useDebouncedValue(value, 200), {
      initialProps: {value: 'a'}
    })
    expect(result.current).toBe('a')
    rerender({value: 'ab'})
    act(() => {
      jest.advanceTimersByTime(150)
    })
    rerender({value: 'abc'})
    act(() => {
      jest.advanceTimersByTime(150)
    })
    expect(result.current).toBe('a')
    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(result.current).toBe('abc')
  })
})
