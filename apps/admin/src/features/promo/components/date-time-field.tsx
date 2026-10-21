'use client'

import {enGB, pl} from '@daypicker/react/locale'
import {CalendarClock, X} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {useId, useState} from 'react'

import {Button} from '@shop/ui/button'
import {Calendar} from '@shop/ui/calendar'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {cn} from '@shop/ui/lib/utils'
import {Popover, PopoverContent, PopoverTrigger} from '@shop/ui/popover'

/** `yyyy-mm-ddTHH:mm` in UTC, or '' for none. The calendar shows that day as a plain date. */
type Value = string

const pad = (n: number) => String(n).padStart(2, '0')
const toDay = (d: Date) => `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function toDate(day: string) {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function label(value: Value, locale: string) {
  if (!value) return null
  const f = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC'
  })
  return `${f.format(new Date(`${value}:00.000Z`))} UTC`
}

/** A day from the calendar plus a time, both in UTC; the calendar unfolds out of the field. */
export function DateTimeField({
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedBy
}: {
  id: string
  value: Value
  onChange: (value: Value) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const t = useTranslations('promo')
  const locale = useLocale()
  const timeId = useId()
  const [open, setOpen] = useState(false)
  const day = value.slice(0, 10)
  const time = value.slice(11, 16) || '00:00'
  const text = label(value, locale)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex h-9 min-w-0 items-center gap-2 rounded-plate border border-border bg-surface px-3 text-left text-sm transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad data-[state=open]:border-white/20',
          text ? 'text-fg' : 'text-muted'
        )}>
        <CalendarClock aria-hidden className="size-4 shrink-0 text-muted" />
        <span className="tabular truncate">{text ?? t('noDate')}</span>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-3">
        <Calendar
          mode="single"
          locale={locale === 'pl' ? pl : enGB}
          weekStartsOn={1}
          defaultMonth={day ? toDate(day) : undefined}
          selected={day ? toDate(day) : undefined}
          onSelect={d => {
            onChange(d ? `${toDay(d)}T${time}` : '')
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={timeId}>{t('time')}</Label>
          <Input
            id={timeId}
            type="time"
            className="tabular w-28"
            value={time}
            disabled={!day}
            onChange={e => {
              if (day && e.target.value) onChange(`${day}T${e.target.value}`)
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            onClick={() => {
              onChange('')
            }}>
            <X aria-hidden className="size-4" />
            {t('clearDate')}
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
