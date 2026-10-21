import {act, renderHook} from '@testing-library/react'
import type {MouseEvent} from 'react'

import {usePendingHref} from './use-pending-href'

const click = (init: Partial<MouseEvent> = {}) =>
  ({
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...init
  }) as MouseEvent

describe('usePendingHref', () => {
  it('starts with nothing pending', () => {
    const {result} = renderHook(() => usePendingHref('/'))
    expect(result.current.pending).toBeNull()
  })

  it('marks the clicked href at once', () => {
    const {result} = renderHook(() => usePendingHref('/'))
    act(() => {
      result.current.mark('/orders')(click())
    })
    expect(result.current.pending).toBe('/orders')
  })

  it('clears when the pathname changes', () => {
    const {result, rerender} = renderHook(({path}) => usePendingHref(path), {
      initialProps: {path: '/'}
    })
    act(() => {
      result.current.mark('/orders')(click())
    })
    rerender({path: '/orders'})
    expect(result.current.pending).toBeNull()
  })

  it.each([
    ['meta', {metaKey: true}],
    ['ctrl', {ctrlKey: true}],
    ['shift', {shiftKey: true}],
    ['alt', {altKey: true}],
    ['middle button', {button: 1}]
  ])('ignores a %s click', (_, init) => {
    const {result} = renderHook(() => usePendingHref('/'))
    act(() => {
      result.current.mark('/orders')(click(init))
    })
    expect(result.current.pending).toBeNull()
  })
})
