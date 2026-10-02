import {renderHook} from '@testing-library/react'

import {useScrollLock} from './use-scroll-lock'

const root = () => document.documentElement

describe('useScrollLock', () => {
  it('locks while active and restores when inactive', () => {
    const {rerender} = renderHook(
      ({active}) => {
        useScrollLock(active)
      },
      {
        initialProps: {active: true}
      }
    )
    expect(root().style.overflow).toBe('hidden')
    rerender({active: false})
    expect(root().style.overflow).toBe('')
  })

  it('stays locked until the last of several callers releases', () => {
    const outer = renderHook(() => {
      useScrollLock(true)
    })
    const inner = renderHook(() => {
      useScrollLock(true)
    })
    inner.unmount()
    expect(root().style.overflow).toBe('hidden')
    outer.unmount()
    expect(root().style.overflow).toBe('')
    expect(root().style.paddingRight).toBe('')
  })

  it('compensates for the scrollbar width so the page does not shift', () => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1015})
    Object.defineProperty(root(), 'clientWidth', {configurable: true, value: 1000})
    const {unmount} = renderHook(() => {
      useScrollLock(true)
    })
    expect(root().style.paddingRight).toBe('15px')
    unmount()
    expect(root().style.paddingRight).toBe('')
  })
})
