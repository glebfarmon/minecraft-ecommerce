import {Toaster} from '@/components/toaster'
import {useReportError} from '@/hooks/use-report-error'
import {IntlWrapper} from '@/test/render-with-providers'
import {findToast, queryToast} from '@/test/toast'
import {act, render, renderHook} from '@testing-library/react'

describe('useReportError', () => {
  it('keeps a 409 inline and does not toast it', () => {
    const inline = jest.fn()
    const {result} = renderHook(() => useReportError(inline), {wrapper: IntlWrapper})
    render(<Toaster />, {wrapper: IntlWrapper})
    act(() => {
      result.current({status: 409, data: {message: 'stale'}})
    })
    expect(inline).toHaveBeenCalledWith(expect.stringContaining('Someone else changed'))
    expect(queryToast('alert')).toBeNull()
  })

  it('toasts any other error with the translated sentence', async () => {
    const inline = jest.fn()
    const {result} = renderHook(() => useReportError(inline), {wrapper: IntlWrapper})
    render(<Toaster />, {wrapper: IntlWrapper})
    act(() => {
      result.current({status: 403, data: {message: 'forbidden'}})
    })
    expect(inline).not.toHaveBeenCalled()
    expect(await findToast('alert')).toHaveTextContent('Error')
  })
})
