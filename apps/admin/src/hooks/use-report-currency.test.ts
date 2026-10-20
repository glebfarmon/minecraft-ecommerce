import {act, renderHook} from '@testing-library/react'

import {useReportCurrency} from './use-report-currency'

afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
})

describe('useReportCurrency', () => {
  it('defaults to EUR and ignores a junk stored value', () => {
    localStorage.setItem('admin.reportCurrency', 'USD')
    const {result} = renderHook(() => useReportCurrency())
    expect(result.current[0]).toBe('EUR')
  })

  it('stores the choice and shares it with other users of the hook', () => {
    const a = renderHook(() => useReportCurrency())
    const b = renderHook(() => useReportCurrency())
    act(() => {
      a.result.current[1]('PLN')
    })
    expect(localStorage.getItem('admin.reportCurrency')).toBe('PLN')
    expect(b.result.current[0]).toBe('PLN')
  })

  it('still switches when the browser refuses storage', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const {result} = renderHook(() => useReportCurrency())
    act(() => {
      result.current[1]('PLN')
    })
    expect(result.current[0]).toBe('PLN')
    act(() => {
      result.current[1]('EUR')
    })
    expect(result.current[0]).toBe('EUR')
  })
})
