'use client'

import {type DragHandleProps, SortableList} from '@/features/catalog/components/sortable-list'
import type {ProductForm} from '@/features/catalog/schemas'
import {type Control, type UseFormRegister, useFieldArray, useWatch} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'

type Locale = 'en' | 'pl'
type SectionPath = `translations.${Locale}.sections.${number}`
type EntryPath = `${SectionPath}.entries.${number}`

// react-hook-form types array indexes as `${number}`; String() keeps the lint rule happy.
const sectionPath = (locale: Locale, i: number) =>
  `translations.${locale}.sections.${String(i)}` as SectionPath
const entryPath = (section: SectionPath, i: number) =>
  `${section}.entries.${String(i)}` as EntryPath
type Props = {
  locale: Locale
  control: Control<ProductForm>
  register: UseFormRegister<ProductForm>
  disabled: boolean
}

function Handle({label, handle}: {label: string; handle: DragHandleProps}) {
  return (
    <button
      type="button"
      aria-label={`Move ${label}`}
      className="text-muted-foreground cursor-grab touch-none rounded px-1 hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
      {...handle}>
      ⠿
    </button>
  )
}

/** The perk sections of one translation tab: titled groups of command / text / cooldown lines. */
export function SectionsEditor({locale, control, register, disabled}: Props) {
  const {fields, append, remove, move} = useFieldArray({
    control,
    name: `translations.${locale}.sections`
  })

  return (
    <div className="flex flex-col gap-3">
      <SortableList
        items={fields}
        label={`Sections (${locale.toUpperCase()})`}
        disabled={disabled}
        className="flex flex-col gap-3"
        onMove={(_, from, to) => {
          move(from, to)
        }}>
        {(field, handle) => {
          const index = fields.findIndex(f => f.id === field.id)
          return (
            <Section
              locale={locale}
              index={index}
              control={control}
              register={register}
              disabled={disabled}
              handle={handle}
              onRemove={() => {
                remove(index)
              }}
            />
          )
        }}
      </SortableList>
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => {
            append({title: '', entries: []})
          }}>
          + Section
        </Button>
      )}
    </div>
  )
}

function Section({
  locale,
  index,
  control,
  register,
  disabled,
  handle,
  onRemove
}: Omit<Props, 'locale'> & {
  locale: Locale
  index: number
  handle: DragHandleProps
  onRemove: () => void
}) {
  const section = sectionPath(locale, index)
  const {fields, append, remove, move} = useFieldArray({control, name: `${section}.entries`})
  const title = useWatch({control, name: `${section}.title`})
  const name = title.trim() || `section ${String(index + 1)}`

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        {!disabled && <Handle label={name} handle={handle} />}
        <Input
          aria-label="Section title"
          placeholder="Section title"
          {...register(`${section}.title`)}
        />
        {!disabled && (
          <Button type="button" variant="outline" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <SortableList
        items={fields}
        label={`Lines of ${name}`}
        disabled={disabled}
        className="flex flex-col gap-2"
        onMove={(_, from, to) => {
          move(from, to)
        }}>
        {(field, lineHandle) => {
          const i = fields.findIndex(f => f.id === field.id)
          const path = entryPath(section, i)
          return (
            <div className="flex flex-wrap items-center gap-2">
              {!disabled && <Handle label={`line ${String(i + 1)}`} handle={lineHandle} />}
              <Input
                aria-label="Command"
                placeholder="/command"
                className="w-40"
                {...register(`${path}.cmd`)}
              />
              <Input
                aria-label="Text"
                placeholder="Text"
                className="min-w-40 flex-1"
                {...register(`${path}.text`)}
              />
              <Input
                aria-label="Cooldown"
                placeholder="Cooldown"
                className="w-28"
                {...register(`${path}.cooldown`)}
              />
              {!disabled && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    remove(i)
                  }}>
                  Remove
                </Button>
              )}
            </div>
          )
        }}
      </SortableList>
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => {
            append({cmd: '', text: '', cooldown: ''})
          }}>
          + Line
        </Button>
      )}
    </div>
  )
}
