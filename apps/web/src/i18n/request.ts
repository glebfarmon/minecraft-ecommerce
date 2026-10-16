import type {AbstractIntlMessages} from 'next-intl'
import {hasLocale} from 'next-intl'
import {getRequestConfig} from 'next-intl/server'
import * as rootParams from 'next/root-params'

import en from '@shop/messages/en.json'
import pl from '@shop/messages/pl.json'

import {routing} from './routing'

const FILES = {en, pl} as const

export default getRequestConfig(async ({locale: explicit}) => {
  const requested = explicit ?? (await rootParams.locale())
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  return {locale, messages: FILES[locale] as AbstractIntlMessages}
})
