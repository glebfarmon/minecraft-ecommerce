'use client'

import {RichTextField} from '@/components/rich-text/rich-text-field'
import {type DragHandleProps, SortableList} from '@/features/catalog/components/sortable-list'
import {RulesPreview} from '@/features/content/components/rules-preview'
import {editionDate} from '@/features/content/lib/edition-date'
import {
  RESTORE_RULES_KEY,
  type RulesForm,
  documentToForm,
  emptyItem,
  emptySection,
  formToDocument
} from '@/features/content/lib/rules-form'
import {useApiError, useErrorText} from '@/hooks/use-error-text'
import {
  useGetRulesDraftQuery,
  usePublishRulesMutation,
  useRestoreRulesVersionMutation,
  useSaveRulesDraftMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useEffect, useRef, useState} from 'react'
import {
  type Control,
  Controller,
  type FieldError,
  type FieldErrors,
  type Resolver,
  get,
  useFieldArray,
  useForm,
  useFormState,
  useWatch
} from 'react-hook-form'

import {type RulesDocument, RulesDocumentSchema} from '@shop/shared/rules'
import {Button} from '@shop/ui/button'
import {Label} from '@shop/ui/label'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@shop/ui/tabs'

type Locale = 'en' | 'pl'
const LOCALES = ['en', 'pl'] as const
type SectionPath = `sections.${number}`
type TextPath = `${SectionPath}.title.${Locale}` | `${SectionPath}.items.${number}.text.${Locale}`

const STALE = 'Someone else changed the draft. Reload to see their version.'
const PUBLISHED = 'Published. Visible on the site within about a minute.'
const FALLBACK = 'Uses the English text'
const SECTIONS_LIMIT = 'The rules can have at most 50 sections.'
const ITEMS_LIMIT = 'A section can hold at most 100 rules.'

/** An error on the array itself (its length), not on one of its entries. */
function hasArrayError(errors: unknown, path: string) {
  const e = get(errors, path) as {message?: string; root?: {message?: string}} | undefined
  return Boolean(e?.root?.message ?? e?.message)
}

// The schema checks what the API will get: new ids filled in, empty PL texts dropped.
const documentResolver = valibotResolver(RulesDocumentSchema)
const resolver: Resolver<RulesForm, unknown, RulesDocument> = (values, context, options) =>
  documentResolver(formToDocument(values), context, options as never)

const isStale = (error: unknown) => (error as {status?: unknown}).status === 409

// react-hook-form types array indexes as `${number}`; String() keeps the lint rule happy.
const sectionPath = (i: number) => `sections.${String(i)}` as SectionPath
/** A section title, or with `item` the text of one of its rules. */
const textPath = (section: number, locale: Locale, item?: number) =>
  (item === undefined
    ? `${sectionPath(section)}.title.${locale}`
    : `${sectionPath(section)}.items.${String(item)}.text.${locale}`) as TextPath
const fieldId = (name: string) => `rules-${name.replace(/\./g, '-')}`

export function RulesEditor() {
  const errorText = useErrorText()
  const apiError = useApiError()
  const draft = useGetRulesDraftQuery()
  const [save, {isLoading: saving}] = useSaveRulesDraftMutation()
  const [publish, {isLoading: publishing}] = usePublishRulesMutation()
  // The versions list runs the restore; sharing its state hands the restored draft to this form.
  const [, restored] = useRestoreRulesVersionMutation({fixedCacheKey: RESTORE_RULES_KEY})
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [tab, setTab] = useState<Locale>('en')

  const form = useForm<RulesForm, unknown, RulesDocument>({
    resolver,
    defaultValues: {sections: []}
  })
  const {control, handleSubmit, reset} = form
  const {isDirty} = useFormState({control})
  const values = useWatch({control}) as RulesForm

  // The draft revision these values are based on: set on load, after our own successful save and
  // after a restore, never from a refetch, so a Save after a 409 cannot overwrite the other edit.
  const revision = useRef<number | null>(null)

  const loaded = draft.data !== undefined
  useEffect(() => {
    if (!draft.data) return
    revision.current = draft.data.revision
    reset(documentToForm(draft.data.content))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; refetches must not reset
  }, [loaded])

  // A restore replaces the form and the revision (an external store, hence the effect)…
  const restoredAt = restored.fulfilledTimeStamp
  // RTK keeps a fixedCacheKey result after unmount: a restore done before this editor mounted
  // is already in the draft it loads, so applying it again would bring back an old revision.
  const restoredBeforeMount = useRef(restoredAt)
  useEffect(() => {
    if (!restored.data || restoredAt === undefined) return
    if (restoredAt === restoredBeforeMount.current) return
    revision.current = restored.data.revision
    reset(documentToForm(restored.data.content))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per restore
  }, [restoredAt])
  // …and makes this editor's messages about the replaced content stale.
  const [seenRestore, setSeenRestore] = useState(restoredAt)
  if (restoredAt !== seenRestore) {
    setSeenRestore(restoredAt)
    setError(null)
    setStatus(null)
    setConfirmPublish(false)
  }

  if (draft.isLoading) return <p>Loading rules…</p>
  if (!draft.data) return <p role="alert">Could not load the rules. Refresh the page.</p>

  const busy = saving || publishing || restored.isLoading

  // Only the active language is mounted, so show the tab that holds an error, or Save looks dead.
  // Length errors (sections, rules per section) are shown in both tabs, so they need no switch.
  const onInvalid = (invalid: FieldErrors<RulesForm>) => {
    const {sections} = form.getValues()
    const hasError = (l: Locale) =>
      sections.some(
        (section, si) =>
          get(invalid, textPath(si, l)) !== undefined ||
          section.items.some((_, ii) => get(invalid, textPath(si, l, ii)) !== undefined)
      )
    const withErrors = LOCALES.filter(hasError)
    const [first] = withErrors
    if (first && !withErrors.includes(tab)) setTab(first)
  }

  async function onSave(content: RulesDocument) {
    setError(null)
    setStatus(null)
    setConfirmPublish(false)
    if (revision.current === null) return
    const result = await save({body: {content, revision: revision.current}})
    if (result.error) {
      setError(isStale(result.error) ? STALE : apiError(result.error))
      return
    }
    revision.current = result.data.revision
    // The saved content carries the ids given to new sections and rules.
    reset(documentToForm(result.data.content))
    setStatus('Draft saved. Publish it to show it on the site.')
  }

  async function onPublish() {
    setConfirmPublish(false)
    setError(null)
    setStatus(null)
    if (revision.current === null) return
    // The revision this form shows: if someone saved since, the API refuses (409) instead of
    // publishing their edit unseen.
    const result = await publish({body: {revision: revision.current}})
    if (result.error) setError(isStale(result.error) ? STALE : apiError(result.error))
    else setStatus(PUBLISHED)
  }

  const rootError = (() => {
    const {errors} = form.formState
    return hasArrayError(errors, 'sections') ? SECTIONS_LIMIT : errorText(errors.root?.message)
  })()

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <form
        onSubmit={e => void handleSubmit(onSave, onInvalid)(e)}
        noValidate
        className="flex min-w-0 flex-col gap-4">
        <Tabs
          value={tab}
          onValueChange={value => {
            setTab(value as Locale)
          }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList aria-label="Language">
              {LOCALES.map(l => (
                <TabsTrigger key={l} value={l}>
                  {l.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex flex-wrap items-center gap-2">
              {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
              <Button type="submit" disabled={busy}>
                Save draft
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isDirty || busy}
                title={isDirty ? 'Save the draft before publishing' : undefined}
                onClick={() => {
                  setStatus(null)
                  setConfirmPublish(true)
                }}>
                Publish
              </Button>
            </div>
          </div>

          {confirmPublish && !isDirty && (
            <div className="flex flex-wrap items-center gap-2 rounded-card bg-card p-4">
              <p className="mr-auto text-sm">
                {`Publish as the edition of ${editionDate(new Date())}?`}
              </p>
              <Button type="button" disabled={busy} onClick={() => void onPublish()}>
                Publish now
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmPublish(false)
                }}>
                Cancel
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
              {error}
            </p>
          )}
          {status && (
            <p role="status" className="rounded-plate bg-ok-soft px-4 py-3 text-ok">
              {status}
            </p>
          )}
          {rootError && <p className="text-sm text-destructive">{rootError}</p>}

          <TabsContent value={tab}>
            {/* Tab triggers stay outside the fieldset, so the language can switch while saving. */}
            <fieldset disabled={busy} className="min-w-0">
              <Sections locale={tab} control={control} disabled={busy} />
            </fieldset>
          </TabsContent>
        </Tabs>
      </form>
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
        <RulesPreview content={values} locale={tab} />
      </aside>
    </div>
  )
}

type EditorProps = {
  locale: Locale
  control: Control<RulesForm, unknown, RulesDocument>
  /** A contenteditable ignores `fieldset disabled`; locked while a request runs. */
  disabled: boolean
}

function Sections({locale, control, disabled}: EditorProps) {
  const {fields, append, remove, move} = useFieldArray({control, name: 'sections'})

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No sections yet. Add the first one.</p>
      )}
      <SortableList
        items={fields}
        label="Sections"
        className="flex flex-col gap-4"
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
              disabled={disabled}
              handle={handle}
              onRemove={() => {
                remove(index)
              }}
            />
          )
        }}
      </SortableList>
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => {
          append(emptySection())
        }}>
        Add section
      </Button>
    </div>
  )
}

function Section({
  locale,
  index,
  control,
  disabled,
  handle,
  onRemove
}: EditorProps & {index: number; handle: DragHandleProps; onRemove: () => void}) {
  const section = sectionPath(index)
  const {fields, append, remove, move} = useFieldArray({control, name: `${section}.items`})
  // Undefined for a moment after a remove or reset.
  const title = useWatch({control, name: `${section}.title.en`}) as string | undefined
  const {errors} = useFormState({control, name: `${section}.items`})
  const tooMany = hasArrayError(errors, `${section}.items`)
  const n = String(index + 1)
  const name = (title ?? '').trim() || `section ${n}`
  const tag = locale.toUpperCase()

  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-5">
      <div className="flex items-end gap-2">
        <Handle label={name} handle={handle} />
        <TextField
          control={control}
          disabled={disabled}
          name={textPath(index, locale)}
          label={`Section ${n} title (${tag})`}
          className="flex-1"
        />
        <ConfirmDelete label={`Delete section ${n}`} onConfirm={onRemove} />
      </div>
      <SortableList
        items={fields}
        label={`Rules in ${name}`}
        className="flex flex-col gap-2"
        onMove={(_, from, to) => {
          move(from, to)
        }}>
        {(field, ruleHandle) => {
          const i = fields.findIndex(f => f.id === field.id)
          const number = `${n}.${String(i + 1)}`
          return (
            <div className="flex items-start gap-2">
              <Handle label={`rule ${number}`} handle={ruleHandle} />
              <span className="w-9 shrink-0 pt-2 text-sm text-muted-foreground tabular-nums">
                {number}
              </span>
              <TextField
                control={control}
                disabled={disabled}
                name={textPath(index, locale, i)}
                label={`Rule ${number} (${tag})`}
                multiline
                hideLabel
                className="flex-1"
              />
              <ConfirmDelete
                label={`Delete rule ${number}`}
                onConfirm={() => {
                  remove(i)
                }}
              />
            </div>
          )
        }}
      </SortableList>
      {tooMany && <p className="text-sm text-destructive">{ITEMS_LIMIT}</p>}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => {
          append(emptyItem())
        }}>
        Add rule
      </Button>
    </div>
  )
}

function Handle({label, handle}: {label: string; handle: DragHandleProps}) {
  return (
    <button
      type="button"
      aria-label={`Move ${label}`}
      className="cursor-grab touch-none self-start rounded px-1 py-1.5 text-muted-foreground hover:bg-card-raised focus-visible:ring-2 focus-visible:outline-none"
      {...handle}>
      ⠿
    </button>
  )
}

function TextField({
  control,
  disabled,
  name,
  label,
  multiline = false,
  hideLabel = false,
  className
}: Pick<EditorProps, 'control' | 'disabled'> & {
  name: TextPath
  label: string
  multiline?: boolean
  hideLabel?: boolean
  className?: string
}) {
  const errorText = useErrorText()
  // Undefined for a moment after a remove or reset.
  const value = useWatch({control, name}) as string | undefined
  const {errors} = useFormState({control, name})
  const error = errorText((get(errors, name) as FieldError | undefined)?.message)
  const id = fieldId(name)
  // An empty PL text is fine: the site shows the English one (and so does the preview).
  const hint = name.endsWith('.pl') && !(value ?? '').trim() ? FALLBACK : undefined
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ')

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      <Label
        id={`${id}-label`}
        onClick={() => document.getElementById(id)?.focus()}
        className={hideLabel ? 'sr-only' : 'text-xs text-muted-foreground'}>
        {label}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({field}) => (
          <RichTextField
            id={id}
            value={field.value || ''}
            onChange={field.onChange}
            multiline={multiline}
            links
            disabled={disabled}
            placeholder={hint}
            aria-labelledby={`${id}-label`}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy || undefined}
          />
        )}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function ConfirmDelete({label, onConfirm}: {label: string; onConfirm: () => void}) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming)
    return (
      <Button
        type="button"
        variant="outline"
        aria-label={label}
        className="self-start"
        onClick={() => {
          setConfirming(true)
        }}>
        Delete
      </Button>
    )
  return (
    <div className="flex shrink-0 gap-1 self-start">
      <Button type="button" variant="outline" className="text-destructive" onClick={onConfirm}>
        Confirm delete
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setConfirming(false)
        }}>
        Cancel
      </Button>
    </div>
  )
}
