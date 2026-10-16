import {hasLocale} from 'next-intl'
import {getRequestConfig} from 'next-intl/server'
import * as rootParams from 'next/root-params'

import en from '@shop/messages/en.json'
import pl from '@shop/messages/pl.json'

import {applyOverrides} from './apply-overrides'
import {getMessageOverrides} from './get-message-overrides'
import {routing} from './routing'

const FILES = {en, pl} as const

export default getRequestConfig(async ({locale: explicit}) => {
  const requested = explicit ?? (await rootParams.locale())
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  // Admin overrides on top of the file texts; `{}` when the API is down, so the files always render.
  const overrides = await getMessageOverrides(locale)
  return {locale, messages: applyOverrides(FILES[locale], overrides)}
})
