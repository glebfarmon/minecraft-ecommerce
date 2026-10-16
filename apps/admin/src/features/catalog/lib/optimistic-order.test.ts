import {act, renderHook} from '@testing-library/react'

import {useOptimisticOrder} from './optimistic-order'

const a = {id: 'a'}
const b = {id: 'b'}
const c = {id: 'c'}

describe('useOptimisticOrder', () => {
  it('shows the new order at once and keeps it until the server list arrives', async () => {
    let resolve: (r: {error?: unknown}) => void = () => undefined
    const save = jest.fn(() => new Promise<{error?: unknown}>(r => (resolve = r)))
    const {result, rerender} = renderHook(({items}) => useOptimisticOrder(items, save), {
      initialProps: {items: [a, b, c]}
    })
    let done: Promise<void> = Promise.resolve()
    act(() => {
      done = result.current.move(['c', 'a', 'b'])
    })
    expect(result.current.items.map(i => i.id)).toEqual(['c', 'a', 'b'])
    await act(async () => {
      resolve({})
      await done
    })
    expect(result.current.items.map(i => i.id)).toEqual(['c', 'a', 'b'])
    rerender({items: [c, a, b]})
    expect(result.current.items.map(i => i.id)).toEqual(['c', 'a', 'b'])
    expect(save).toHaveBeenCalledWith(['c', 'a', 'b'], ['a', 'b', 'c'])
  })

  it('exposes the server order a change is made from', () => {
    const {result} = renderHook(() => useOptimisticOrder([b, a], () => Promise.resolve({})))
    expect(result.current.base).toEqual(['b', 'a'])
  })

  it('puts the items back and explains why when the save fails', async () => {
    const save = jest.fn(() => Promise.resolve({error: {status: 409, data: {message: 'stale'}}}))
    const {result} = renderHook(() => useOptimisticOrder([a, b, c], save))
    await act(async () => {
      await result.current.move(['b', 'a', 'c'])
    })
    expect(result.current.items.map(i => i.id)).toEqual(['a', 'b', 'c'])
    expect(result.current.error).toMatch(/Someone else changed this/)
  })
})
