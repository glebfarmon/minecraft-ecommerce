'use client'

import {type RconForm, RconFormSchema} from '@/features/catalog/schemas'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  type GetCatalogServerApiResponse,
  useTestCatalogServerRconMutation,
  useUpdateCatalogServerRconMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {type ReactNode, useState} from 'react'
import {Controller, useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Checkbox} from '@shop/ui/checkbox'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

type TestResult = {ok: true; ms: number} | {ok: false; error: string}

const TEST_ERRORS: Record<string, string> = {
  timeout: 'No answer within 5 seconds. Check host, port and the server’s firewall.',
  unreachable: 'Could not connect. Check host and port.',
  auth_failed: 'Wrong RCON password.',
  decrypt_failed: 'The stored password cannot be read (the key changed). Enter it again.'
}

export function RconPanel({server}: {server: GetCatalogServerApiResponse}) {
  const [updateRcon, {isLoading: saving}] = useUpdateCatalogServerRconMutation()
  const [testRcon, {isLoading: testing}] = useTestCatalogServerRconMutation()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

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
    setSaved(false)
    setResult(null)
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
      setError(apiErrorMessage(res.error))
      return
    }
    setValue('password', '')
    setValue('clearPassword', false)
    setSaved(true)
  }

  async function test() {
    setError(null)
    setSaved(false)
    setResult(null)
    const res = await testRcon({id: server.id})
    if (res.error) setError(apiErrorMessage(res.error))
    else if (res.data.ok === true && 'ms' in res.data) setResult({ok: true, ms: res.data.ms})
    else setResult({ok: false, error: 'error' in res.data ? res.data.error : 'unreachable'})
  }

  const busy = saving || testing
  const message = !result
    ? null
    : result.ok
      ? `Connected in ${String(result.ms)} ms.`
      : (TEST_ERRORS[result.error] ?? TEST_ERRORS.unreachable)

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
      {saved && (
        <p role="status" className="rounded-plate bg-ok-soft px-4 py-3 text-ok md:col-span-2">
          RCON settings saved.
        </p>
      )}
      {message && (
        <p role="status" className="rounded-plate bg-card-raised px-4 py-3 md:col-span-2">
          {message}
        </p>
      )}

      <Field id="rcon-host" label="Host">
        <Input id="rcon-host" {...register('host')} />
      </Field>
      <Field id="rcon-port" label="Port" error={errors.port?.message}>
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
        label="New password"
        hint={server.rconPasswordSet ? 'A password is set.' : 'No password set.'}>
        <Input
          id="rcon-password"
          type="password"
          autoComplete="new-password"
          placeholder="Leave empty to keep it"
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
          <Label htmlFor="rcon-clear">Remove the stored password</Label>
        </div>
      )}

      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button type="submit" disabled={busy}>
          Save RCON
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void test()}>
          Test connection
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
