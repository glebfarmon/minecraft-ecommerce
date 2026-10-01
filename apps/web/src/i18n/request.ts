import type { AbstractIntlMessages } from 'next-intl';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import * as rootParams from 'next/root-params';

import { routing } from './routing';

export default getRequestConfig(async ({ locale: explicit }) => {
  const requested = explicit ?? (await rootParams.locale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)) as {
    default: AbstractIntlMessages;
  };
  return { locale, messages: messages.default };
});
