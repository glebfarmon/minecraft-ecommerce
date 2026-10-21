'use client'

import {Skeleton} from '@/components/skeleton'
import {notify} from '@/components/toaster'
import {type RconForm, RconFormSchema} from '@/features/catalog/schemas'
import {useApiError, useErrorText} from '@/hooks/use-error-text'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {
  type GetCatalogServerApiResponse,
  useTestCatalogServerRconMutation,
  useUpdateCatalogServerRconMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'
import {Controller, useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Checkbox} from '@shop/ui/checkbox'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

const TEST_ERRORS = ['timeout', 'unreachable', 'auth_failed', 'decrypt_failed'] as const

/** A refused host is a problem with the host field, so it stays next to the form. */
const isHostRefusal = (error: unknown) =>
  String((error as {data?: {message?: unknown}}).data?.message).startsWith('rcon_host_')

export function RconPanel({server}: {server: GetCatalogServerApiResponse}) {
  const t = useTranslations('catalog')
  const apiError = useApiError()
  const errorText = useErrorText()
  const [updateRcon, {isLoading: saving}] = useUpdateCatalogServerRconMutation()
  const [testRcon, {isLoading: testing}] = useTestCatalogServerRconMutation()
  const [error, setError] = useMessage()
  const report = useReportError(setError)

  const form = useForm<RconForm>({
    resolver: valibotResolver(RconFormSchema),
    defaultValues: {
      host: server.rcon?.host ?? '',
      port: server.rcon?.port ? String(server.rcon.port) : '',
      password: '',
      clearPassword: false
    }
  })
  const {register, control, handleSubmit, setValue} = form
  const {errors} = useFormState({control})

  async function save({host, port, password, clearPassword}: RconForm) {
    setError(null)
    const res = await updateRcon({
      id: server.id,
      body: {
        host: host || null,
        port: port ? Number(port) : null,
        ...(password && {password}),
        ...(clearPassword && {clearPassword: true})
      }
    })
    if (res.error) {
      if (isHostRefusal(res.error)) setError(apiError(res.error))
      else report(res.error)
      return
    }
    setValue('password', '')
    setValue('clearPassword', false)
    notify.ok(t('rconSettingsSaved'))
  }

  async function test() {
    setError(null)
    const res = await testRcon({id: server.id})
    if (res.error) report(res.error)
    else if (res.data.ok === true && 'ms' in res.data)
      notify.ok(t('rconConnected', {ms: res.data.ms}))
    else {
      const reason = 'error' in res.data ? res.data.error : 'unreachable'
      notify.error(t(`rconTest_${TEST_ERRORS.find(e => e === reason) ?? 'unreachable'}`))
    }
  }

  const busy = saving || testing

  return (
    <form
      onSubmit={e => void handleSubmit(save)(e)}
      noValidate
      className="grid gap-4 md:grid-cols-2">
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad md:col-span-2">
          {error}
        </p>
      )}

      <Field id="rcon-host" label={t('host')}>
        <Input id="rcon-host" {...register('host')} />
      </Field>
      <Field id="rcon-port" label={t('port')} error={errorText(errors.port?.message)}>
        <Input
          id="rcon-port"
          inputMode="numeric"
          aria-invalid={errors.port ? true : undefined}
          aria-describedby={errors.port ? 'rcon-port-error' : undefined}
          {...register('port')}
        />
      </Field>
      <Field
        id="rcon-password"
        label={t('newPassword')}
        hint={server.rconPasswordSet ? t('passwordSet') : t('passwordNotSet')}>
        <Input
          id="rcon-password"
          type="password"
          autoComplete="new-password"
          placeholder={t('leaveEmptyToKeepIt')}
          {...register('password')}
        />
      </Field>
      {server.rconPasswordSet && (
        <div className="flex items-center gap-2 md:col-span-2">
          <Controller
            control={control}
            name="clearPassword"
            render={({field: f}) => (
              <Checkbox
                id="rcon-clear"
                ref={f.ref}
                checked={f.value}
                onBlur={f.onBlur}
                onCheckedChange={checked => {
                  f.onChange(checked === true)
                }}
              />
            )}
          />
          <Label htmlFor="rcon-clear">{t('removeTheStoredPassword')}</Label>
        </div>
      )}

      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button type="submit" disabled={busy}>
          {t('saveRcon')}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void test()}>
          {t('testConnection')}
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  hint,
  children
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** `RconPanel` while the server loads: its grid with the labels, values as placeholders. */
export function RconPanelSkeleton() {
  const t = useTranslations('catalog')
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[t('host'), t('port'), t('newPassword')].map(label => (
        <div key={label} className="flex flex-col gap-1">
          <Label>{label}</Label>
          <Skeleton className="h-9" />
        </div>
      ))}
      <div aria-hidden className="flex flex-wrap gap-2 md:col-span-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
    </div>
  )
}
