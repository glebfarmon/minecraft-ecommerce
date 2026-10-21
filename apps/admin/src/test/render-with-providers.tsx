import {Toaster} from '@/components/toaster'
import type {AdminLocale} from '@/i18n/locale'
import {makeStore} from '@/lib/api/store'
import {type RenderOptions, type RenderResult, render} from '@testing-library/react'
import {NextIntlClientProvider} from 'next-intl'
import type {ReactElement, ReactNode} from 'react'
import {Provider} from 'react-redux'

import {TooltipProvider} from '@shop/ui/tooltip'

import en from '../../messages/en.json'
import pl from '../../messages/pl.json'

const FILES = {en, pl} as const

/** The message provider alone, as a `wrapper` for `renderHook` or a hand-built tree. */
export function IntlWrapper({
  children,
  locale = 'en'
}: {
  children: ReactNode
  locale?: AdminLocale
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={FILES[locale]}>
      {children}
    </NextIntlClientProvider>
  )
}

/**
 * Renders inside the tooltip provider (with the toaster) and the real message file for `locale` (English by default), with a fresh
 * RTK Query store unless `store: false`; stub the network with `jest.spyOn(global, 'fetch')`.
 */
export function renderWithProviders(
  ui: ReactElement,
  {locale = 'en', store = true}: {locale?: AdminLocale; store?: boolean} = {}
): RenderResult {
  const content = (
    <IntlWrapper locale={locale}>
      <TooltipProvider>
        {ui}
        <Toaster />
      </TooltipProvider>
    </IntlWrapper>
  )
  return render(store ? <Provider store={makeStore()}>{content}</Provider> : content)
}

/** Messages and tooltips, for tests that call RTL's `render(ui, {wrapper})` themselves so `rerender` keeps them. */
export function IntlTooltipWrapper({children}: {children: ReactNode}) {
  return (
    <IntlWrapper>
      <TooltipProvider>{children}</TooltipProvider>
    </IntlWrapper>
  )
}

/** Plain `render` with the English messages as its `wrapper`, so `rerender` keeps them. */
export function renderWithIntl(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, {wrapper: IntlWrapper, ...options})
}
