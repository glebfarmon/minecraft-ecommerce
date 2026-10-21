'use client'

import {DayPicker, type DayPickerProps} from '@daypicker/react'
import {ChevronLeft, ChevronRight} from 'lucide-react'

import {cn} from './lib/utils'

const NAV_BUTTON =
  'grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-card hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30'

/**
 * DayPicker in the admin's tokens, without its stylesheet. The range band and its shimmer are
 * `.cal-*` rules in the app's CSS, because they key off the cell's row and column.
 */
function Calendar({className, classNames, ...props}: DayPickerProps) {
  return (
    <DayPicker
      className={cn('cal relative w-fit select-none', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'flex flex-col gap-2',
        nav: 'absolute inset-x-0 top-0 z-20 flex items-center justify-between',
        button_previous: NAV_BUTTON,
        button_next: NAV_BUTTON,
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'text-[13px] font-semibold capitalize',
        month_grid: 'border-collapse',
        weekday: 'size-9 text-[11px] font-medium text-muted uppercase',
        day: 'cal-day relative size-9 p-0 text-center',
        day_button:
          'cal-day-button relative z-10 grid size-9 place-items-center rounded-full text-[13px] tabular-nums transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        today: 'cal-today',
        outside: 'text-muted/50',
        disabled: 'opacity-30',
        hidden: 'invisible',
        selected: 'cal-selected',
        range_start: 'cal-range-start',
        range_middle: 'cal-range-middle',
        range_end: 'cal-range-end',
        ...classNames
      }}
      components={{
        Chevron: ({orientation, className: chevron}) =>
          orientation === 'left' ? (
            <ChevronLeft aria-hidden className={cn('size-4', chevron)} />
          ) : (
            <ChevronRight aria-hidden className={cn('size-4', chevron)} />
          )
      }}
      {...props}
    />
  )
}

export {Calendar}
