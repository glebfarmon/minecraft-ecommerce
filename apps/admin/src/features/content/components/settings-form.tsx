'use client'

import {Card} from '@/components/card'
import {FormSection} from '@/components/form-section'
import {type SettingsForm, SettingsFormSchema, toSettings} from '@/features/content/schemas'
import {useApiError, useErrorText} from '@/hooks/use-error-text'
import {useMessage} from '@/hooks/use-message'
import {useGetContentSettingsQuery, useUpdateContentSettingsMutation} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useTranslations} from 'next-intl'
import {type ReactNode, useEffect, useRef, useState} from 'react'
import {type FieldPath, useForm, useFormState, useWatch} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

const EMPTY: SettingsForm = {plain: '', accent: '', serverIp: '', discordUrl: '', supportEmail: ''}

export function SettingsForm({canEdit}: {canEdit: boolean}) {
  const t = useTranslations('content')
  const errorText = useErrorText()
  const apiError = useApiError()
  const settings = useGetContentSettingsQuery()
  const [update, {isLoading: saving}] = useUpdateContentSettingsMutation()
  const [error, setError] = useMessage()
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

  if (settings.isLoading) return <p>{t('loadingSettings')}</p>
  if (!settings.data) return <p role="alert">{t('couldNotLoadTheSettingsRefresh')}</p>

  async function save(v: SettingsForm) {
    setError(null)
    setSaved(false)
    if (version.current === null) return
    const result = await update({body: {...toSettings(v), version: version.current}})
    if (result.error) {
      setError(apiError(result.error))
      return
    }
    version.current = result.data.version
    setSaved(true)
  }

  const errorOf = (name: FieldPath<SettingsForm>) => errorText(errors[name]?.message)
  const fieldProps = (name: FieldPath<SettingsForm>) => ({
    'id': `settings-${name}`,
    'aria-invalid': errorOf(name) ? true : undefined,
    'aria-describedby': errorOf(name) ? `settings-${name}-error` : undefined
  })

  return (
    <form
      onSubmit={e => void handleSubmit(save)(e)}
      noValidate
      className="grid items-start gap-4 xl:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="rounded-plate bg-ok-soft px-4 py-3 text-ok">
            {t('savedLiveOnTheSiteWithin')}
          </p>
        )}

        <FormSection
          title={t('brand')}
          description={t('theWordmarkInTheSiteHeader')}
          disabled={!canEdit}>
          <Field name="plain" label={t('siteName')} error={errorOf('plain')}>
            <Input {...fieldProps('plain')} {...register('plain')} />
          </Field>
          <Field name="accent" label={t('accentPart')} error={errorOf('accent')}>
            <Input {...fieldProps('accent')} {...register('accent')} />
          </Field>
        </FormSection>

        <FormSection
          title={t('contact')}
          description={t('shownInTheFooterAndOn')}
          disabled={!canEdit}>
          <Field name="serverIp" label={t('serverAddress')} error={errorOf('serverIp')}>
            <Input {...fieldProps('serverIp')} {...register('serverIp')} />
          </Field>
          <Field name="discordUrl" label={t('discordLink')} error={errorOf('discordUrl')}>
            <Input {...fieldProps('discordUrl')} {...register('discordUrl')} />
          </Field>
          <Field name="supportEmail" label={t('supportEmail')} error={errorOf('supportEmail')}>
            <Input {...fieldProps('supportEmail')} {...register('supportEmail')} />
          </Field>
        </FormSection>

        {canEdit && (
          <div>
            <Button type="submit" disabled={saving}>
              {t('save')}
            </Button>
          </div>
        )}
      </div>

      <Card title={t('preview')}>
        <p data-testid="wordmark-preview" className="text-xl font-semibold break-all">
          {values.plain}
          <span data-accent className="text-accent">
            {values.accent}
          </span>
        </p>
      </Card>
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
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={`settings-${name}`}>{label}</Label>
      {children}
      {error && (
        <p id={`settings-${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
