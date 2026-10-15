'use client'

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import type {HTMLAttributes, ReactNode} from 'react'

import {cn} from '@shop/ui/lib/utils'

/** Spread onto the drag handle (a button): pointer, touch and keyboard (space, arrows, space). */
export type DragHandleProps = HTMLAttributes<HTMLElement>

type Props<T extends {id: string}> = {
  items: readonly T[]
  /** Accessible name of the list, e.g. "Servers". */
  label: string
  /** New id order, plus the moved item's old and new index (for `useFieldArray().move`). */
  onMove: (ids: string[], from: number, to: number) => void
  direction?: 'vertical' | 'horizontal'
  disabled?: boolean
  className?: string
  itemClassName?: string
  children: (item: T, handle: DragHandleProps) => ReactNode
}

export function SortableList<T extends {id: string}>({
  items,
  label,
  onMove,
  direction = 'vertical',
  disabled = false,
  className,
  itemClassName,
  children
}: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates})
  )
  const ids = items.map(i => i.id)

  function onDragEnd({active, over}: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    onMove(arrayMove(ids, from, to), from, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: `To move an item in ${label}, press space, use the arrow keys, then press space again. Escape cancels.`
        }
      }}>
      <SortableContext
        items={ids}
        disabled={disabled}
        strategy={
          direction === 'vertical' ? verticalListSortingStrategy : horizontalListSortingStrategy
        }>
        <ul aria-label={label} className={cn(direction === 'horizontal' && 'flex', className)}>
          {items.map(item => (
            <SortableItem key={item.id} id={item.id} className={itemClassName}>
              {handle => children(item, handle)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({
  id,
  className,
  children
}: {
  id: string
  className?: string
  children: (handle: DragHandleProps) => ReactNode
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})
  return (
    <li
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      data-dragging={isDragging || undefined}
      className={cn('relative data-[dragging]:z-10 data-[dragging]:opacity-80', className)}>
      {children({...attributes, ...listeners})}
    </li>
  )
}
