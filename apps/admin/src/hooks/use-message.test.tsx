import type {AdminLocale} from '@/i18n/locale'
import {IntlWrapper} from '@/test/render-with-providers'
import {act, renderHook} from '@testing-library/react'
import type {ReactNode} from 'react'

import {useMessage} from './use-message'

describe('useMessage', () => {
  it('holds a message until the language changes, then hides it instead of showing the wrong language', () => {
    let locale: AdminLocale = 'en'
    const wrapper = ({children}: {children: ReactNode}) => (
      <IntlWrapper locale={locale}>{children}</IntlWrapper>
    )
    const {result, rerender} = renderHook(() => useMessage(), {wrapper})
    act(() => {
      result.current[1]('Could not save.')
    })
    expect(result.current[0]).toBe('Could not save.')
    locale = 'pl'
    rerender()
    expect(result.current[0]).toBeNull()
    act(() => {
      result.current[1]('Nie udało się zapisać.')
    })
    expect(result.current[0]).toBe('Nie udało się zapisać.')
    act(() => {
      result.current[1](null)
    })
    expect(result.current[0]).toBeNull()
  })
})
