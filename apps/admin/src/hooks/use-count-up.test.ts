import {renderHook, waitFor} from '@testing-library/react'

import {useCountUp} from './use-count-up'

describe('useCountUp', () => {
  it('starts at 0 and ends at the target', async () => {
    const {result} = renderHook(() => useCountUp(1234, 50))
    expect(result.current).toBe(0)
    await waitFor(() => {
      expect(result.current).toBe(1234)
    })
  })

  it('counts from the previous value when the target changes', async () => {
    const {result, rerender} = renderHook(({to}) => useCountUp(to, 50), {initialProps: {to: 10}})
    await waitFor(() => {
      expect(result.current).toBe(10)
    })
    rerender({to: 20})
    await waitFor(() => {
      expect(result.current).toBe(20)
    })
  })
})
