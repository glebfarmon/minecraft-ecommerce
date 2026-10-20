const WARSAW_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

/** The Europe/Warsaw calendar day of an instant, as YYYY-MM-DD. */
export function warsawDay(at: Date): string {
  return WARSAW_DAY.format(at)
}

/** Moves a YYYY-MM-DD day by whole days (calendar arithmetic, no time zone involved). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
