import {act, renderHook} from '@testing-library/react'

import {useDelayedFlag} from './use-delayed-flag'

describe('useDelayedFlag', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('stays false while inactive', () => {
    const {result} = renderHook(() => useDelayedFlag(false))
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(false)
  })

  it('never turns on when the work finishes within the delay', () => {
    const {result, rerender} = renderHook(({on}) => useDelayedFlag(on), {initialProps: {on: true}})
    act(() => {
      jest.advanceTimersByTime(150)
    })
    rerender({on: false})
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(false)
  })

  it('turns on after the delay and stays on for the minimum visible time', () => {
    const {result, rerender} = renderHook(({on}) => useDelayedFlag(on), {initialProps: {on: true}})
    act(() => {
      jest.advanceTimersByTime(199)
    })
    expect(result.current).toBe(false)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe(true)
    act(() => {
      jest.advanceTimersByTime(100)
    })
    rerender({on: false})
    expect(result.current).toBe(true)
    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(result.current).toBe(true)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })
})
