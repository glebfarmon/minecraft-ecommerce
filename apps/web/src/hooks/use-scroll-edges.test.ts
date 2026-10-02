import {act, renderHook} from '@testing-library/react'

import {useScrollEdges} from './use-scroll-edges'

function makeScroller({scrollWidth, clientWidth, scrollLeft}: Record<string, number>) {
  const el = document.createElement('div')
  const set = (key: string, value: number) =>
    Object.defineProperty(el, key, {value, configurable: true, writable: true})
  set('scrollWidth', scrollWidth ?? 0)
  set('clientWidth', clientWidth ?? 0)
  set('scrollLeft', scrollLeft ?? 0)
  return {el, set}
}

describe('useScrollEdges', () => {
  it('reports hidden content only at the end when at the start', () => {
    const {el} = makeScroller({scrollWidth: 500, clientWidth: 200, scrollLeft: 0})
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(result.current).toEqual({start: false, end: true})
  })

  it('reports both sides in the middle and only the start at the end', () => {
    const {el, set} = makeScroller({scrollWidth: 500, clientWidth: 200, scrollLeft: 100})
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(result.current).toEqual({start: true, end: true})
    set('scrollLeft', 300)
    act(() => {
      el.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toEqual({start: true, end: false})
  })

  it('reports nothing when the content fits', () => {
    const {el} = makeScroller({scrollWidth: 200, clientWidth: 200, scrollLeft: 0})
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(result.current).toEqual({start: false, end: false})
  })

  it('ignores sub-pixel rounding', () => {
    const {el} = makeScroller({scrollWidth: 200, clientWidth: 199.5, scrollLeft: 0.4})
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(result.current).toEqual({start: false, end: false})
  })

  it('re-measures when the element or a child resizes', () => {
    let notify: () => void = () => undefined
    const observe = jest.fn()
    window.ResizeObserver = class {
      constructor(cb: () => void) {
        notify = cb
      }
      observe = observe
      unobserve() {}
      disconnect() {}
    }
    const {el, set} = makeScroller({scrollWidth: 200, clientWidth: 200, scrollLeft: 0})
    el.appendChild(document.createElement('button'))
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(observe).toHaveBeenCalledTimes(2) // the element and its child
    set('scrollWidth', 500)
    act(() => {
      notify()
    })
    expect(result.current).toEqual({start: false, end: true})
  })

  it('removes the scroll listener on unmount', () => {
    const {el} = makeScroller({scrollWidth: 500, clientWidth: 200, scrollLeft: 0})
    const add = jest.spyOn(el, 'addEventListener')
    const remove = jest.spyOn(el, 'removeEventListener')
    const {unmount} = renderHook(() => useScrollEdges({current: el}))
    const handler = add.mock.calls.find(([type]) => type === 'scroll')?.[1]
    unmount()
    expect(handler).toBeDefined()
    expect(remove).toHaveBeenCalledWith('scroll', handler)
  })
})
