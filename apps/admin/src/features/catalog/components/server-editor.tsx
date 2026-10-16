'use client'

import {RconPanel} from '@/features/catalog/components/rcon-panel'
import {type ServerForm, ServerFormSchema} from '@/features/catalog/schemas'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  useCreateCatalogServerMutation,
  useDeleteCatalogServerMutation,
  useGetCatalogServerQuery,
  useUpdateCatalogServerMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useRouter} from 'next/navigation'
import {type ReactNode, useEffect, useRef, useState} from 'react'
import {Controller, type FieldPath, useForm, useFormState, useWatch} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Checkbox} from '@shop/ui/checkbox'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

type Props = {id?: string; canEdit: boolean; canRcon: boolean}

const EMPTY: ServerForm = {
  slug: '',
  name: '',
  accent: '#ff6b1a',
  onAccent: '#000000',
  isActive: false
}

export function ServerEditor({id, canEdit, canRcon}: Props) {
  const router = useRouter()
  const server = useGetCatalogServerQuery({id: id ?? ''}, {skip: !id})
  const [create, {isLoading: creating}] = useCreateCatalogServerMutation()
  const [update, {isLoading: updating}] = useUpdateCatalogServerMutation()
  const [remove, {isLoading: removing}] = useDeleteCatalogServerMutation()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm<ServerForm>({
    resolver: valibotResolver(ServerFormSchema),
    defaultValues: EMPTY
  })
  const {register, control, handleSubmit, setValue} = form
  const {errors} = useFormState({control})

  // The version our values are based on: set when a server loads and after our own successful
  // save, never from a refetch, so a Save after a 409 cannot overwrite the other admin's change.
  const version = useRef<number | null>(null)

  const loadedId = server.data?.id
  useEffect(() => {
    if (!server.data) return
    const {slug, name, accent, onAccent, isActive} = server.data
    version.current = server.data.version
    form.reset({slug, name, accent, onAccent, isActive})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when another server loads
  }, [loadedId])

  const values = useWatch({control}) as ServerForm

  if (id && server.isLoading) return <p>Loading server…</p>
  if (id && !server.data) return <p role="alert">Could not load the server. Refresh the page.</p>

  // The slug stays locked while the stored server is enabled.
  const locked = server.data?.isActive === true
  const busy = creating || updating || removing

  async function save(v: ServerForm) {
    setError(null)
    setSaved(false)
    if (!id) {
      const {slug, name, accent, onAccent} = v
      const result = await create({body: {slug, name, accent, onAccent}})
      if (result.error) setError(apiErrorMessage(result.error))
      else router.replace(`/catalog/servers/${result.data.id}`)
      return
    }
    if (version.current === null) return
    const result = await update({id, body: {...v, version: version.current}})
    if (result.error) {
      setError(apiErrorMessage(result.error))
      return
    }
    version.current = result.data.version
    setSaved(true)
  }

  async function onDelete() {
    if (!id || version.current === null) return
    setError(null)
    setConfirmDelete(false)
    const result = await remove({id, version: String(version.current)})
    if (result.error) setError(apiErrorMessage(result.error))
    else router.push('/catalog')
  }

  const errorOf = (name: FieldPath<ServerForm>) => errors[name]?.message
  const fieldProps = (name: FieldPath<ServerForm>) => ({
    'id': `server-${name}`,
    'aria-invalid': errorOf(name) ? true : undefined,
    'aria-describedby': errorOf(name) ? `server-${name}-error` : undefined
  })
  const colorField = (name: 'accent' | 'onAccent', label: string) => (
    <Field name={name} label={label} error={errorOf(name)}>
      <div className="flex items-center gap-2">
        <Input {...fieldProps(name)} {...register(name)} />
        <input
          type="color"
          aria-hidden
          tabIndex={-1}
          value={/^#[0-9a-f]{6}$/i.test(values[name]) ? values[name] : '#000000'}
          onChange={e => {
            setValue(name, e.target.value, {shouldDirty: true, shouldValidate: true})
          }}
        />
      </div>
    </Field>
  )

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <form onSubmit={e => void handleSubmit(save)(e)} noValidate className="flex flex-col gap-6">
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Saved. Live on the site within a minute.</p>}

        <span
          data-testid="tab-preview"
          className="w-fit rounded px-3 py-1 text-sm font-medium"
          style={{background: values.accent, color: values.onAccent}}>
          {values.name || 'Server'}
        </span>

        <fieldset disabled={!canEdit} className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Name" error={errorOf('name')}>
              <Input {...fieldProps('name')} {...register('name')} />
            </Field>
            <Field
              name="slug"
              label="Slug"
              error={errorOf('slug')}
              hint={locked ? 'Disable the server to change its slug.' : undefined}>
              <Input {...fieldProps('slug')} readOnly={locked} {...register('slug')} />
            </Field>
            {colorField('accent', 'Accent')}
            {colorField('onAccent', 'Text color')}
          </div>

          {id && (
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isActive"
                render={({field: f}) => (
                  <Checkbox
                    id="server-isActive"
                    ref={f.ref}
                    checked={f.value}
                    onBlur={f.onBlur}
                    onCheckedChange={checked => {
                      f.onChange(checked === true)
                    }}
                  />
                )}
              />
              <Label htmlFor="server-isActive">Enabled</Label>
            </div>
          )}
        </fieldset>

        {canEdit && (
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Save
            </Button>
            {id &&
              (confirmDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onDelete()}>
                  Confirm delete
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setConfirmDelete(true)
                  }}>
                  Delete
                </Button>
              ))}
          </div>
        )}
      </form>

      {canRcon && server.data && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">RCON</h2>
          <RconPanel server={server.data} />
        </section>
      )}
    </div>
  )
}

function Field({
  name,
  label,
  error,
  hint,
  children
}: {
  name: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`server-${name}`}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p id={`server-${name}-error`} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
