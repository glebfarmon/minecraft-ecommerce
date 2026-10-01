import {act, renderHook} from '@testing-library/react'

import {useScrolled} from './use-scrolled'

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', {value: y, configurable: true})
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

describe('useScrolled', () => {
  afterEach(() => {
    Object.defineProperty(window, 'scrollY', {value: 0, configurable: true})
  })

  it('is false at the top of the page', () => {
    const {result} = renderHook(() => useScrolled())
    expect(result.current).toBe(false)
  })

  it('reads scroll position on mount', () => {
    Object.defineProperty(window, 'scrollY', {value: 500, configurable: true})
    const {result} = renderHook(() => useScrolled())
    expect(result.current).toBe(true)
  })

  it('turns on after scrolling past the threshold', () => {
    const {result} = renderHook(() => useScrolled())
    scrollTo(9)
    expect(result.current).toBe(true)
  })

  it('stays off at exactly the threshold', () => {
    const {result} = renderHook(() => useScrolled())
    scrollTo(8)
    expect(result.current).toBe(false)
  })

  it('turns off when back at the top', () => {
    const {result} = renderHook(() => useScrolled())
    scrollTo(300)
    scrollTo(0)
    expect(result.current).toBe(false)
  })

  it('removes the scroll listener on unmount', () => {
    const remove = jest.spyOn(window, 'removeEventListener')
    const {unmount} = renderHook(() => useScrolled())
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
    remove.mockRestore()
  })
})
