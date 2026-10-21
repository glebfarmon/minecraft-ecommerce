'use client'

import {enGB, pl} from '@daypicker/react/locale'
import {CalendarDays, X} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {useState} from 'react'

import {Button} from '@shop/ui/button'
import {Calendar} from '@shop/ui/calendar'
import {cn} from '@shop/ui/lib/utils'
import {Popover, PopoverContent, PopoverTrigger} from '@shop/ui/popover'

/** Whole days as `yyyy-mm-dd`; '' is open-ended. */
export type DayRange = {from: string; to: string}

const pad = (n: number) => String(n).padStart(2, '0')
const toDay = (d: Date) => `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function toDate(day: string) {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function label(range: DayRange, locale: string) {
  const f = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric'})
  const from = range.from && toDate(range.from)
  const to = range.to && toDate(range.to)
  if (from && to) return range.from === range.to ? f.format(from) : f.formatRange(from, to)
  if (from) return `${f.format(from)} –`
  if (to) return `– ${f.format(to)}`
  return null
}

/**
 * A from–to day range in one field: the calendar unfolds out of it, the chosen days light up
 * with a sweep that runs from the first day to the last.
 */
export function DateRangePicker({
  id,
  value,
  onChange,
  className
}: {
  id?: string
  value: DayRange
  onChange: (range: DayRange) => void
  className?: string
}) {
  const t = useTranslations('datePicker')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const text = label(value, locale)
  const selected = value.from
    ? {from: toDate(value.from), to: value.to ? toDate(value.to) : undefined}
    : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          'group flex h-9 min-w-0 items-center gap-2 rounded-plate border border-border bg-surface px-3 text-left text-sm transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[state=open]:border-white/20',
          text ? 'text-fg' : 'text-muted',
          className
        )}>
        <CalendarDays aria-hidden className="size-4 shrink-0 text-muted" />
        <span className="tabular truncate">{text ?? t('anyTime')}</span>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-3">
        <Calendar
          mode="range"
          locale={locale === 'pl' ? pl : enGB}
          weekStartsOn={1}
          defaultMonth={selected?.to ?? selected?.from}
          selected={selected}
          onSelect={range => {
            onChange({
              from: range?.from ? toDay(range.from) : '',
              to: range?.to ? toDay(range.to) : ''
            })
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value.from && !value.to}
            onClick={() => {
              onChange({from: '', to: ''})
            }}>
            <X aria-hidden className="size-4" />
            {t('clear')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setOpen(false)
            }}>
            {t('done')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
