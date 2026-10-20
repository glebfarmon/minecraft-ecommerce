import {getRequestConfig} from 'next-intl/server'
import {cookies} from 'next/headers'

import en from '../../messages/en.json'
import pl from '../../messages/pl.json'
import {LOCALE_COOKIE, parseLocale} from './locale'

const FILES = {en, pl} as const

export default getRequestConfig(async () => {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value)
  return {locale, messages: FILES[locale]}
})
