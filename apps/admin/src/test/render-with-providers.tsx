import type {AdminLocale} from '@/i18n/locale'
import {makeStore} from '@/lib/api/store'
import {type RenderResult, render} from '@testing-library/react'
import {NextIntlClientProvider} from 'next-intl'
import type {ReactElement} from 'react'
import {Provider} from 'react-redux'

import {TooltipProvider} from '@shop/ui/tooltip'

import en from '../../messages/en.json'
import pl from '../../messages/pl.json'

const FILES = {en, pl} as const

/**
 * Renders inside the tooltip provider and the real message file for `locale` (English by default), with a fresh
 * RTK Query store unless `store: false`; stub the network with `jest.spyOn(global, 'fetch')`.
 */
export function renderWithProviders(
  ui: ReactElement,
  {locale = 'en', store = true}: {locale?: AdminLocale; store?: boolean} = {}
): RenderResult {
  const content = (
    <NextIntlClientProvider locale={locale} messages={FILES[locale]}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>
  )
  return render(store ? <Provider store={makeStore()}>{content}</Provider> : content)
}
