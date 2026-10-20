import type {AdminLocale} from '@/i18n/locale'

import type en from './messages/en.json'

declare module 'next-intl' {
  interface AppConfig {
    Locale: AdminLocale
    Messages: typeof en
  }
}
