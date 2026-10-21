'use client'

import {FormSection} from '@/components/form-section'
import {PageHeader} from '@/components/page-header'
import {Skeleton} from '@/components/skeleton'
import {notify} from '@/components/toaster'
import {EMPTY_PROMO_FORM, toPromoForm, toPromoInput} from '@/features/promo/lib/promo-form'
import {type PromoForm, PromoFormSchema} from '@/features/promo/schemas'
import {useErrorText} from '@/hooks/use-error-text'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {
  useCreatePromoCodeMutation,
  useDeletePromoCodeMutation,
  useGetPromoCodeQuery,
  useListCatalogCategoriesQuery,
  useListCatalogProductsQuery,
  useListCatalogServersQuery,
  useUpdatePromoCodeMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useLocale, useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {type ReactNode, useEffect, useRef, useState} from 'react'
import {Controller, type FieldPath, useForm, useFormState, useWatch} from 'react-hook-form'

import {CURRENCIES} from '@shop/shared/catalog'
import {PROMO_KINDS} from '@shop/shared/promo'
import {Button} from '@shop/ui/button'
import {Checkbox} from '@shop/ui/checkbox'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'

import {CodeDice} from './code-dice'
import {DateTimeField} from './date-time-field'
import {PromoStatusDot} from './promo-status'

type Props = {
  id?: string
  /** The route's loading state: the editor's layout with placeholders, before the id is known. */
  skeleton?: boolean
}

/** Create or edit a promo code. A used code keeps its text, discount and scope (`locked`). */
export function PromoEditor({id, skeleton = false}: Props) {
  const t = useTranslations('promo')
  const common = useTranslations('common')
  const locale = useLocale()
  const errorText = useErrorText()
  const router = useRouter()
  const promo = useGetPromoCodeQuery({id: id ?? ''}, {skip: !id || skeleton})
  const categories = useListCatalogCategoriesQuery(undefined, {skip: skeleton})
  const products = useListCatalogProductsQuery({}, {skip: skeleton})
  const servers = useListCatalogServersQuery(undefined, {skip: skeleton})
  const [create, {isLoading: creating}] = useCreatePromoCodeMutation()
  const [update, {isLoading: updating}] = useUpdatePromoCodeMutation()
  const [remove, {isLoading: removing}] = useDeletePromoCodeMutation()
  const [error, setError] = useMessage()
  const report = useReportError(setError)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm<PromoForm>({
    resolver: valibotResolver(PromoFormSchema),
    defaultValues: EMPTY_PROMO_FORM
  })
  const {register, control, handleSubmit, setValue} = form
  const {errors} = useFormState({control})
  const kind = useWatch({control, name: 'kind'})

  // The version our values are based on: set on load and after our own save, never from a
  // refetch, so a Save after a 409 cannot overwrite the other admin's change.
  const version = useRef<number | null>(null)
  const loadedId = promo.data?.id
  useEffect(() => {
    if (!promo.data) return
    version.current = promo.data.version
    form.reset(toPromoForm(promo.data))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when another code loads
  }, [loadedId])

  const loading = useHoldLoading(Boolean(id) && promo.isLoading) || skeleton
  const back = {href: '/promo-codes', label: t('back')}
  if (!loading && id && !promo.data)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('title')} back={back} />
        <p role="alert" className="rounded-card bg-card p-5">
          {t('codeLoadFailed')}
        </p>
      </div>
    )

  const locked = promo.data?.locked === true
  const busy = creating || updating || removing
  const slot = (input: ReactNode, size = 'h-9') => (loading ? <Skeleton className={size} /> : input)

  async function save(values: PromoForm) {
    setError(null)
    const body = toPromoInput(values)
    if (!id) {
      const result = await create({body})
      if (result.error) report(result.error)
      else {
        notify.ok(t('created'))
        router.replace(`/promo-codes/${result.data.id}`)
      }
      return
    }
    if (version.current === null) return
    const result = await update({id, body: {...body, version: version.current}})
    if (result.error) {
      report(result.error)
      return
    }
    version.current = result.data.version
    form.reset(toPromoForm(result.data))
    notify.ok(t('saved'))
  }

  async function onDelete() {
    if (!id || version.current === null) return
    setError(null)
    setConfirmDelete(false)
    const result = await remove({id, version: String(version.current)})
    if (result.error) report(result.error)
    else {
      notify.ok(t('deleted'))
      router.push('/promo-codes')
    }
  }

  const errorOf = (name: FieldPath<PromoForm>) =>
    errorText((errors as Record<string, {message?: string} | undefined>)[name]?.message)
  const a11y = (name: FieldPath<PromoForm>) => ({
    'id': `promo-${name}`,
    'aria-invalid': errorOf(name) ? true : undefined,
    'aria-describedby': errorOf(name) ? `promo-${name}-error` : undefined
  })

  const serverName = new Map((servers.data ?? []).map(s => [s.id, s.name]))
  const categoryItems = (categories.data ?? []).map(c => ({
    id: c.id,
    label: locale === 'pl' ? c.names.pl : c.names.en
  }))
  const productItems = (products.data ?? []).map(p => ({
    id: p.id,
    label: p.name,
    detail: serverName.get(p.serverId)
  }))

  const title = loading ? (
    <Skeleton className="my-[3px] h-7 w-56 max-w-full rounded-full" />
  ) : promo.data ? (
    <span className="font-mono">{promo.data.code}</span>
  ) : (
    t('newCode')
  )

  return (
    <div className="flex flex-col gap-6">
      {loading && (
        <span role="status" className="sr-only">
          {common('loading')}
        </span>
      )}
      <PageHeader
        title={title}
        back={back}
        actions={promo.data && !loading ? <PromoStatusDot status={promo.data.status} /> : undefined}
      />
      <form
        onSubmit={e => void handleSubmit(save)(e)}
        noValidate
        className="flex max-w-3xl min-w-0 flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
            {error}
          </p>
        )}

        <FormSection title={t('sectionCode')} description={t('sectionCodeHint')}>
          {locked && !loading && (
            <p className="text-[13px] text-muted md:col-span-2">{t('lockedHint')}</p>
          )}
          <Field name="code" label={t('code')} error={errorOf('code')} wide>
            <div className="flex min-w-0 items-center gap-2">
              {slot(
                <Input
                  {...a11y('code')}
                  autoComplete="off"
                  spellCheck={false}
                  className="tabular font-mono tracking-[0.12em] uppercase"
                  disabled={locked}
                  {...register('code')}
                />,
                'h-9 flex-1'
              )}
              {loading ? (
                <Skeleton className="size-9 shrink-0 rounded-full" />
              ) : (
                <CodeDice
                  disabled={locked}
                  onCode={(code, done) => {
                    setValue('code', code, {shouldDirty: true, shouldValidate: done})
                  }}
                />
              )}
            </div>
          </Field>
          <Field name="kind" label={t('kind')}>
            {slot(
              <Controller
                control={control}
                name="kind"
                render={({field: f}) => (
                  <Select
                    id="promo-kind"
                    value={f.value}
                    disabled={locked}
                    options={PROMO_KINDS.map(k => ({value: k, label: t(`kind${k}`)}))}
                    onValueChange={f.onChange}
                  />
                )}
              />
            )}
          </Field>
          <Field
            name="value"
            label={kind === 'FIXED' ? t('amount') : t('percent')}
            error={errorOf('value')}>
            {slot(
              <Input
                {...a11y('value')}
                inputMode="decimal"
                className="tabular"
                disabled={locked}
                {...register('value')}
              />
            )}
          </Field>
          {kind === 'FIXED' && (
            <Field name="currency" label={t('currency')}>
              {slot(
                <Controller
                  control={control}
                  name="currency"
                  render={({field: f}) => (
                    <Select
                      id="promo-currency"
                      value={f.value}
                      disabled={locked}
                      options={CURRENCIES.map(c => ({value: c, label: c}))}
                      onValueChange={f.onChange}
                    />
                  )}
                />
              )}
            </Field>
          )}
        </FormSection>

        <FormSection title={t('sectionLimits')} description={t('sectionLimitsHint')}>
          <Field
            name="maxUses"
            label={t('maxUses')}
            error={errorOf('maxUses')}
            hint={promo.data ? t('usedTimes', {count: promo.data.usedCount}) : undefined}>
            {slot(
              <Input
                {...a11y('maxUses')}
                inputMode="numeric"
                placeholder={t('unlimited')}
                className="tabular"
                {...register('maxUses')}
              />
            )}
          </Field>
          <div className="hidden md:block" />
          {(['startsAt', 'endsAt'] as const).map(name => (
            <Field key={name} name={name} label={t(name)} error={errorOf(name)}>
              {slot(
                <Controller
                  control={control}
                  name={name}
                  render={({field: f}) => (
                    <DateTimeField
                      id={`promo-${name}`}
                      value={f.value}
                      invalid={Boolean(errorOf(name))}
                      describedBy={errorOf(name) ? `promo-${name}-error` : undefined}
                      onChange={next => {
                        f.onChange(next)
                      }}
                    />
                  )}
                />
              )}
            </Field>
          ))}
          <div className="flex items-center gap-2 md:col-span-2">
            {slot(
              <Controller
                control={control}
                name="isActive"
                render={({field: f}) => (
                  <Checkbox
                    id="promo-isActive"
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
            <Label htmlFor="promo-isActive">{t('enabled')}</Label>
          </div>
        </FormSection>

        <FormSection title={t('sectionScope')} description={t('sectionScopeHint')}>
          {(['categoryIds', 'productIds'] as const).map(name => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({field: f}) => (
                <CheckList
                  name={name}
                  legend={name === 'categoryIds' ? t('categories') : t('products')}
                  items={name === 'categoryIds' ? categoryItems : productItems}
                  loading={loading || categories.isLoading || products.isLoading}
                  value={f.value}
                  disabled={locked}
                  onChange={f.onChange}
                />
              )}
            />
          ))}
        </FormSection>

        {loading ? (
          <div aria-hidden className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {id ? t('save') : t('create')}
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
    </div>
  )
}

function Field({
  name,
  label,
  error,
  hint,
  wide = false,
  children
}: {
  name: string
  label: string
  error?: string
  hint?: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={
        wide ? 'flex min-w-0 flex-col gap-1 md:col-span-2' : 'flex min-w-0 flex-col gap-1'
      }>
      <Label htmlFor={`promo-${name}`}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`promo-${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** A scrollable list of checkboxes; an empty selection is fine (both empty = whole shop). */
function CheckList({
  name,
  legend,
  items,
  value,
  onChange,
  disabled,
  loading
}: {
  name: string
  legend: string
  items: {id: string; label: string; detail?: string}[]
  value: string[]
  onChange: (value: string[]) => void
  disabled: boolean
  loading: boolean
}) {
  const chosen = new Set(value)
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex max-h-60 min-w-0 flex-col gap-1 overflow-y-auto rounded-plate bg-card-raised p-2">
        {loading
          ? Array.from({length: 4}, (_, i) => (
              <Skeleton key={i} className="my-1.5 h-3.5 w-3/5 rounded-full" />
            ))
          : items.map(item => {
              const id = `promo-${name}-${item.id}`
              return (
                <div key={item.id} className="flex min-w-0 items-center gap-2 px-1 py-1">
                  <Checkbox
                    id={id}
                    checked={chosen.has(item.id)}
                    disabled={disabled}
                    onCheckedChange={checked => {
                      onChange(
                        checked === true ? [...value, item.id] : value.filter(v => v !== item.id)
                      )
                    }}
                  />
                  <Label htmlFor={id} className="min-w-0 truncate font-normal">
                    {item.label}
                  </Label>
                  {item.detail && (
                    <span className="ml-auto shrink-0 text-xs text-muted">{item.detail}</span>
                  )}
                </div>
              )
            })}
      </div>
    </fieldset>
  )
}
