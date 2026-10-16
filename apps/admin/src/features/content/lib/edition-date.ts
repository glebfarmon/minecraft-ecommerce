const EDITION_DATE = new Intl.DateTimeFormat('en', {dateStyle: 'long', timeZone: 'Europe/Warsaw'})

/** Rules editions are dated in the shop's time zone, whatever the admin's own is. */
export const editionDate = (date: Date | string) => EDITION_DATE.format(new Date(date))
