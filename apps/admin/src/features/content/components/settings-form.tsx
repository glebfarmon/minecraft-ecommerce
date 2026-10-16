'use client'

import {type SettingsForm, SettingsFormSchema, toSettings} from '@/features/content/schemas'
import {apiErrorMessage} from '@/lib/api/error-message'
import {useGetContentSettingsQuery, useUpdateContentSettingsMutation} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {type ReactNode, useEffect, useRef, useState} from 'react'
import {type FieldPath, useForm, useFormState, useWatch} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

const EMPTY: SettingsForm = {plain: '', accent: '', serverIp: '', discordUrl: '', supportEmail: ''}

export function SettingsForm({canEdit}: {canEdit: boolean}) {
  const settings = useGetContentSettingsQuery()
  const [update, {isLoading: saving}] = useUpdateContentSettingsMutation()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<SettingsForm>({
    resolver: valibotResolver(SettingsFormSchema),
    defaultValues: EMPTY
  })
  const {register, control, handleSubmit} = form
  const {errors} = useFormState({control})
  const values = useWatch({control}) as SettingsForm

  // The version our values are based on: set when the settings load and after our own successful
  // save, never from a refetch, so a Save after a 409 cannot overwrite the other admin's change.
  const version = useRef<number | null>(null)

  const isLoaded = settings.data !== undefined
  useEffect(() => {
    if (!settings.data) return
    const {siteName, serverIp, discordUrl, supportEmail} = settings.data
    version.current = settings.data.version
    form.reset({plain: siteName.plain, accent: siteName.accent, serverIp, discordUrl, supportEmail})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; refetches must not reset
  }, [isLoaded])

  if (settings.isLoading) return <p>Loading settings…</p>
  if (!settings.data) return <p role="alert">Could not load the settings. Refresh the page.</p>

  async function save(v: SettingsForm) {
    setError(null)
    setSaved(false)
    if (version.current === null) return
    const result = await update({body: {...toSettings(v), version: version.current}})
    if (result.error) {
      setError(apiErrorMessage(result.error))
      return
    }
    version.current = result.data.version
    setSaved(true)
  }

  const errorOf = (name: FieldPath<SettingsForm>) => errors[name]?.message
  const fieldProps = (name: FieldPath<SettingsForm>) => ({
    'id': `settings-${name}`,
    'aria-invalid': errorOf(name) ? true : undefined,
    'aria-describedby': errorOf(name) ? `settings-${name}-error` : undefined
  })

  return (
    <form
      onSubmit={e => void handleSubmit(save)(e)}
      noValidate
      className="flex max-w-xl flex-col gap-6">
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Saved. Live on the site within a minute.</p>}

      <p data-testid="wordmark-preview" className="text-xl font-semibold">
        {values.plain}
        <span data-accent className="text-primary">
          {values.accent}
        </span>
      </p>

      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <Field name="plain" label="Site name" error={errorOf('plain')}>
          <Input {...fieldProps('plain')} {...register('plain')} />
        </Field>
        <Field name="accent" label="Accent part" error={errorOf('accent')}>
          <Input {...fieldProps('accent')} {...register('accent')} />
        </Field>
        <Field name="serverIp" label="Server address" error={errorOf('serverIp')}>
          <Input {...fieldProps('serverIp')} {...register('serverIp')} />
        </Field>
        <Field name="discordUrl" label="Discord link" error={errorOf('discordUrl')}>
          <Input {...fieldProps('discordUrl')} {...register('discordUrl')} />
        </Field>
        <Field name="supportEmail" label="Support email" error={errorOf('supportEmail')}>
          <Input {...fieldProps('supportEmail')} {...register('supportEmail')} />
        </Field>
      </fieldset>

      {canEdit && (
        <div>
          <Button type="submit" disabled={saving}>
            Save
          </Button>
        </div>
      )}
    </form>
  )
}

function Field({
  name,
  label,
  error,
  children
}: {
  name: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`settings-${name}`}>{label}</Label>
      {children}
      {error && (
        <p id={`settings-${name}-error`} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
