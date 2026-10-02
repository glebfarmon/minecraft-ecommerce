import {act, renderHook} from '@testing-library/react'

import {useTransientFlag} from './use-transient-flag'

describe('useTransientFlag', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('is true for the given time after trigger, then resets', () => {
    const {result} = renderHook(() => useTransientFlag(1000))
    expect(result.current[0]).toBe(false)
    act(() => {
      result.current[1]()
    })
    expect(result.current[0]).toBe(true)
    act(() => {
      jest.advanceTimersByTime(999)
    })
    expect(result.current[0]).toBe(true)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current[0]).toBe(false)
  })

  it('restarts the timer when triggered again', () => {
    const {result} = renderHook(() => useTransientFlag(1000))
    act(() => {
      result.current[1]()
    })
    act(() => {
      jest.advanceTimersByTime(800)
    })
    act(() => {
      result.current[1]()
    })
    act(() => {
      jest.advanceTimersByTime(800)
    })
    expect(result.current[0]).toBe(true)
  })
})
