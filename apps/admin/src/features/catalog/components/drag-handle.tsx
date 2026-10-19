import {GripVertical} from 'lucide-react'
import type {CSSProperties} from 'react'

import {cn} from '@shop/ui/lib/utils'

import type {DragHandleProps} from './sortable-list'

export function DragHandle({
  label,
  handle,
  className,
  style
}: {
  label: string
  handle: DragHandleProps
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      aria-label={`Move ${label}`}
      style={style}
      className={cn(
        'grid size-7 cursor-grab touch-none place-items-center rounded-full text-muted hover:bg-card-raised focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:outline-none',
        className
      )}
      {...handle}>
      <GripVertical aria-hidden className="size-4" />
    </button>
  )
}
