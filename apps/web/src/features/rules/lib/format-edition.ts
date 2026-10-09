import {CONTENT_TIME_ZONE} from '@/config/site'

/** "28 maja 2026" / "May 28, 2026": the edition's calendar date in the servers' time zone. */
export const formatEdition = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {dateStyle: 'long', timeZone: CONTENT_TIME_ZONE}).format(
    new Date(iso)
  )
