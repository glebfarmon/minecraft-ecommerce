const EDITION_DATE = (locale: string) =>
  new Intl.DateTimeFormat(locale, {dateStyle: 'long', timeZone: 'Europe/Warsaw'})

/** Rules editions are dated in the shop's time zone, whatever the admin's own is. */
export const editionDate = (date: Date | string, locale = 'en') =>
  EDITION_DATE(locale).format(new Date(date))
