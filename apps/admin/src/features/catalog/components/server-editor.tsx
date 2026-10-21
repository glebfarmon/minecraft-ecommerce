'use client'

import {Card} from '@/components/card'
import {FormSection} from '@/components/form-section'
import {Skeleton} from '@/components/skeleton'
import {ToneDot} from '@/components/status-dot'
import {notify} from '@/components/toaster'
import {RconPanel, RconPanelSkeleton} from '@/features/catalog/components/rcon-panel'
import {type ServerForm, ServerFormSchema} from '@/features/catalog/schemas'
import {useErrorText} from '@/hooks/use-error-text'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {
  useCreateCatalogServerMutation,
  useDeleteCatalogServerMutation,
  useGetCatalogServerQuery,
  useUpdateCatalogServerMutation
} from '@/lib/api/generated'
import {contrastRatio} from '@/lib/contrast'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {type ReactNode, useEffect, useRef, useState} from 'react'
import {Controller, type FieldPath, useForm, useFormState, useWatch} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Checkbox} from '@shop/ui/checkbox'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

import {EditorLayout} from './editor-layout'
import {ServerCard, ServerCardSkeleton} from './server-card'

type Props = {
  id?: string
  canEdit: boolean
  canRcon: boolean
  /** The route's loading state: the editor's layout with placeholders, before the id is known. */
  skeleton?: boolean
}

const HEX = /^#[0-9a-f]{6}$/i

const EMPTY: ServerForm = {
  slug: '',
  name: '',
  accent: '#ff6b1a',
  onAccent: '#000000',
  isActive: false
}

export function ServerEditor({id, canEdit, canRcon, skeleton = false}: Props) {
  const t = useTranslations('catalog')
  const errorText = useErrorText()
  const router = useRouter()
  const server = useGetCatalogServerQuery({id: id ?? ''}, {skip: !id})
  const [create, {isLoading: creating}] = useCreateCatalogServerMutation()
  const [update, {isLoading: updating}] = useUpdateCatalogServerMutation()
  const [remove, {isLoading: removing}] = useDeleteCatalogServerMutation()
  const [error, setError] = useMessage()
  const report = useReportError(setError)
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

  const loading = useHoldLoading(Boolean(id) && server.isLoading) || skeleton
  if (!loading && id && !server.data) return <p role="alert">{t('couldNotLoadTheServerRefresh')}</p>
  /** While loading, a stored value's control is a placeholder of its size; its label stays. */
  const slot = (input: ReactNode, size = 'h-9') => (loading ? <Skeleton className={size} /> : input)

  // The slug stays locked while the stored server is enabled.
  const locked = server.data?.isActive === true
  const busy = creating || updating || removing

  async function save(v: ServerForm) {
    setError(null)
    if (!id) {
      const {slug, name, accent, onAccent} = v
      const result = await create({body: {slug, name, accent, onAccent}})
      if (result.error) report(result.error)
      else {
        notify.ok(t('serverCreated'))
        router.replace(`/catalog/servers/${result.data.id}`)
      }
      return
    }
    if (version.current === null) return
    const result = await update({id, body: {...v, version: version.current}})
    if (result.error) {
      report(result.error)
      return
    }
    version.current = result.data.version
    notify.ok(t('savedLiveOnTheSiteWithin'))
  }

  async function onDelete() {
    if (!id || version.current === null) return
    setError(null)
    setConfirmDelete(false)
    const result = await remove({id, version: String(version.current)})
    if (result.error) report(result.error)
    else {
      notify.ok(t('serverDeleted'))
      router.push('/catalog')
    }
  }

  const errorOf = (name: FieldPath<ServerForm>) => errorText(errors[name]?.message)
  const fieldProps = (name: FieldPath<ServerForm>) => ({
    'id': `server-${name}`,
    'aria-invalid': errorOf(name) ? true : undefined,
    'aria-describedby': errorOf(name) ? `server-${name}-error` : undefined
  })
  const colorField = (name: 'accent' | 'onAccent', label: string) => (
    <Field name={name} label={label} error={errorOf(name)}>
      <div className="flex items-center gap-2">
        {slot(<Input {...fieldProps(name)} {...register(name)} />, 'h-9 flex-1')}
        {loading ? (
          <Skeleton className="size-9 shrink-0 rounded-full" />
        ) : (
          <input
            type="color"
            aria-hidden
            tabIndex={-1}
            className="size-9 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 transition-transform hover:scale-105 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
            value={HEX.test(values[name]) ? values[name] : '#000000'}
            onChange={e => {
              setValue(name, e.target.value, {shouldDirty: true, shouldValidate: true})
            }}
          />
        )}
      </div>
    </Field>
  )

  const lowContrast =
    HEX.test(values.accent) &&
    HEX.test(values.onAccent) &&
    contrastRatio(values.accent, values.onAccent) < 4.5

  return (
    <EditorLayout
      loading={loading}
      title={id ? server.data?.name || t('server') : t('newServer')}
      preview={
        loading ? (
          <ServerCardSkeleton />
        ) : (
          <ServerCard
            server={{
              name: values.name || t('server'),
              accent: values.accent,
              onAccent: values.onAccent,
              isActive: values.isActive,
              productCount: server.data?.productCount ?? 0,
              rcon: server.data?.rcon ?? null,
              rconPasswordSet: server.data?.rconPasswordSet ?? false
            }}
          />
        )
      }>
      <form onSubmit={e => void handleSubmit(save)(e)} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
            {error}
          </p>
        )}

        <fieldset disabled={!canEdit} className="min-w-0">
          <FormSection title={t('basics')} description={t('howTheServerAppearsInThe')}>
            <Field name="name" label={t('name')} error={errorOf('name')}>
              {slot(<Input {...fieldProps('name')} {...register('name')} />)}
            </Field>
            <Field
              name="slug"
              label={t('slug')}
              error={errorOf('slug')}
              hint={locked ? t('disableToChangeSlug') : undefined}>
              {slot(<Input {...fieldProps('slug')} readOnly={locked} {...register('slug')} />)}
            </Field>
            {colorField('accent', t('accent'))}
            {colorField('onAccent', t('textColor'))}
            {lowContrast && !loading && (
              <div className="md:col-span-2">
                <ToneDot tone="warn" label={t('lowContrast')} />
                <span className="ml-2 text-[13px] text-muted">{t('textOnTheAccentNeedsA')}</span>
              </div>
            )}
            {(id || skeleton) && (
              <div className="flex items-center gap-2 md:col-span-2">
                {slot(
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
                  />,
                  'size-4 rounded-[5px]'
                )}
                <Label htmlFor="server-isActive">{t('enabled')}</Label>
              </div>
            )}
          </FormSection>
        </fieldset>

        {canEdit && loading && (
          <div aria-hidden className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        )}
        {canEdit && !loading && (
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {t('save')}
            </Button>
            {id &&
              (confirmDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void onDelete()}>
                  {t('confirmDelete')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setConfirmDelete(true)
                  }}>
                  {t('delete')}
                </Button>
              ))}
          </div>
        )}
      </form>

      {canRcon && (loading || server.data) && (
        <Card title={t('rcon')}>
          {server.data && !loading ? <RconPanel server={server.data} /> : <RconPanelSkeleton />}
        </Card>
      )}
    </EditorLayout>
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
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`server-${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
