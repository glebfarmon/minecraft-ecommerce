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
  })
})
