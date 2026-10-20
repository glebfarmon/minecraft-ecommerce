'use client'

import {FormSection} from '@/components/form-section'
import {RichTextField} from '@/components/rich-text/rich-text-field'
import {SkeletonRows} from '@/components/skeleton'
import {SectionsEditor} from '@/features/catalog/components/sections-editor'
import {
  emptyProductForm,
  formToCreate,
  formToUpdate,
  productToForm
} from '@/features/catalog/lib/product-form'
import {type ProductForm, ProductFormSchema} from '@/features/catalog/schemas'
import {useApiError, useErrorText} from '@/hooks/use-error-text'
import {useMessage} from '@/hooks/use-message'
import {
  useCreateCatalogProductMutation,
  useDeleteCatalogProductMutation,
  useGetCatalogProductQuery,
  useListCatalogServersQuery,
  useUpdateCatalogProductMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {type ReactNode, useEffect, useRef, useState} from 'react'
import {
  Controller,
  type FieldError,
  type FieldErrors,
  type FieldPath,
  get,
  useForm,
  useFormState,
  useWatch
} from 'react-hook-form'

import {PRODUCT_ICONS, PRODUCT_KINDS} from '@shop/shared/catalog'
import {missingForActive} from '@shop/shared/catalog-admin'
import {Button} from '@shop/ui/button'
import {Checkbox} from '@shop/ui/checkbox'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {cn} from '@shop/ui/lib/utils'
import {Select} from '@shop/ui/select'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@shop/ui/tabs'
import {Textarea} from '@shop/ui/textarea'

import {CommandHelp} from './command-help'
import {EditorLayout} from './editor-layout'
import {ProductCard} from './product-card'

const MISSING_KEY = {
  'price.EUR': 'missingPriceEUR',
  'price.PLN': 'missingPricePLN',
  'translation.en': 'missingTranslationEN',
  'translation.pl': 'missingTranslationPL'
} as const

const LOCALES = [
  {locale: 'en', tab: 'EN'},
  {locale: 'pl', tab: 'PL'}
] as const

type Props = {id?: string; serverId?: string; categoryId?: string; canEdit: boolean}

export function ProductEditor({id, serverId, categoryId, canEdit}: Props) {
  const t = useTranslations('catalog')
  const errorText = useErrorText()
  const apiError = useApiError()
  const router = useRouter()
  const product = useGetCatalogProductQuery({id: id ?? ''}, {skip: !id})
  const servers = useListCatalogServersQuery()
  const [create, {isLoading: creating}] = useCreateCatalogProductMutation()
  const [update, {isLoading: updating}] = useUpdateCatalogProductMutation()
  const [remove, {isLoading: removing}] = useDeleteCatalogProductMutation()
  const [error, setError] = useMessage()
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<'en' | 'pl'>('en')
  // Set when Save is refused because the product is enabled but incomplete.
  const [blockedActive, setBlockedActive] = useState(false)

  const form = useForm<ProductForm>({
    resolver: valibotResolver(ProductFormSchema),
    defaultValues: emptyProductForm(serverId, categoryId)
  })
  const {register, control, handleSubmit, setValue} = form
  const {errors} = useFormState({control})

  // The version this editor's values are based on. Set when a product loads and after our own
  // successful save, never from a refetch: otherwise a Save after a 409 would carry the other
  // admin's version and silently overwrite their change.
  const version = useRef<number | null>(null)

  // Load the stored product once; later refetches must not wipe what the admin is typing.
  const loadedId = product.data?.id
  useEffect(() => {
    if (!product.data) return
    version.current = product.data.version
    form.reset(productToForm(product.data))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when another product loads
  }, [loadedId])

  const values = useWatch({control}) as ProductForm
  const draft = formToCreate({...emptyProductForm(), ...values})
  const missing = missingForActive(draft)
  const incomplete = missing.length > 0
  const missingText = missing.map(m => t(MISSING_KEY[m])).join(', ')
  // Never untick Enabled for the admin: a silent untick would take the product off the shop.
  const activeError =
    blockedActive && values.isActive && incomplete
      ? t('fillOrUntick', {what: missingText})
      : undefined

  /** The commands field the admin typed in last; `{nick}` goes in at its caret. */
  const [lastCommand, setLastCommand] = useState<'grant' | 'revoke'>('grant')

  if (id && product.isLoading) return <SkeletonRows rows={6} />
  if (id && !product.data) return <p role="alert">{t('couldNotLoadTheProductRefresh')}</p>

  const server = servers.data?.find(s => s.id === values.serverId)
  const busy = creating || updating || removing

  // Inactive tabs unmount, so show the tab holding a translation error, or Save looks dead.
  const onInvalid = (invalid: FieldErrors<ProductForm>) => {
    const withErrors = LOCALES.map(l => l.locale).filter(l => invalid.translations?.[l])
    const [first] = withErrors
    if (first && !withErrors.includes(tab)) setTab(first)
  }

  async function save(v: ProductForm) {
    setError(null)
    setSaved(false)
    const blocked = v.isActive && missingForActive(formToCreate(v)).length > 0
    setBlockedActive(blocked)
    if (blocked) return
    if (!id) {
      const result = await create({body: formToCreate(v)})
      if (result.error) setError(apiError(result.error))
      else router.replace(`/catalog/products/${result.data.id}`)
      return
    }
    if (version.current === null) return
    const result = await update({id, body: formToUpdate(v, version.current)})
    if (result.error) {
      setError(apiError(result.error))
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
    if (result.error) setError(apiError(result.error))
    else router.push('/catalog')
  }

  const errorOf = (name: FieldPath<ProductForm>) =>
    errorText((get(errors, name) as FieldError | undefined)?.message)
  const fieldProps = (name: FieldPath<ProductForm>) => ({
    'id': fieldId(name),
    'aria-invalid': errorOf(name) ? true : undefined,
    'aria-describedby': errorOf(name) ? `${fieldId(name)}-error` : undefined
  })
  const commandProps = (name: 'grant' | 'revoke') => ({
    ...register(name),
    onFocus: () => {
      setLastCommand(name)
    }
  })
  function insertToken(token: string) {
    const el = document.getElementById(fieldId(lastCommand))
    if (!(el instanceof HTMLTextAreaElement)) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = el.value.slice(0, start) + token + el.value.slice(end)
    setValue(lastCommand, next, {shouldDirty: true})
    el.value = next
    el.focus()
    el.setSelectionRange(start + token.length, start + token.length)
  }

  const field = (
    name: FieldPath<ProductForm>,
    label: string,
    input: ReactNode,
    hint?: string,
    wide?: boolean
  ) => (
    <Field
      name={name}
      label={label}
      error={errorOf(name)}
      hint={hint}
      className={wide ? 'md:col-span-2' : undefined}>
      {input}
    </Field>
  )

  const storedName = product.data?.translations.en?.name || product.data?.slug
  return (
    <EditorLayout
      title={id ? storedName || t('product') : t('newProduct')}
      preview={
        <ProductCard
          accent={server?.accent ?? 'var(--color-accent)'}
          product={{
            name: values.translations.en.name || values.slug || t('newProduct'),
            mark: values.mark || values.translations.en.name || '',
            icon: values.icon,
            kind: values.kind,
            isActive: values.isActive,
            // A half-typed price is not a number yet; show it as missing, not NaN.
            prices: {
              EUR: Number.isFinite(draft.prices.EUR) ? draft.prices.EUR : null,
              PLN: Number.isFinite(draft.prices.PLN) ? draft.prices.PLN : null
            },
            missing
          }}
        />
      }>
      <form
        onSubmit={e => void handleSubmit(save, onInvalid)(e)}
        noValidate
        className="flex flex-col gap-4">
        {incomplete && (
          <p className="rounded-plate bg-warn-soft px-4 py-3 text-[13px] text-warn">
            {t('missingToEnable', {what: missingText})}
          </p>
        )}
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
          title={t('basics')}
          description={t('whereTheProductSitsAndHow')}
          disabled={!canEdit}>
          {field(
            'serverId',
            t('server'),
            <Controller
              control={control}
              name="serverId"
              render={({field: f}) => (
                <Select
                  {...fieldProps('serverId')}
                  value={f.value}
                  placeholder={t('chooseAServer')}
                  options={(servers.data ?? []).map(s => ({value: s.id, label: s.name}))}
                  onValueChange={v => {
                    f.onChange(v)
                    const next = servers.data?.find(s => s.id === v)
                    if (!next?.categories.some(c => c.id === values.categoryId))
                      setValue('categoryId', '')
                  }}
                />
              )}
            />
          )}
          {field(
            'categoryId',
            t('category'),
            <Controller
              control={control}
              name="categoryId"
              render={({field: f}) => (
                <Select
                  {...fieldProps('categoryId')}
                  value={f.value}
                  placeholder={t('chooseACategory')}
                  options={(server?.categories ?? []).map(c => ({value: c.id, label: c.name}))}
                  onValueChange={f.onChange}
                />
              )}
            />
          )}
          {field('slug', t('slug'), <Input {...fieldProps('slug')} {...register('slug')} />)}
          {field('mark', t('mark'), <Input {...fieldProps('mark')} {...register('mark')} />)}
          {field(
            'kind',
            t('kind'),
            <Controller
              control={control}
              name="kind"
              render={({field: f}) => (
                <Select
                  {...fieldProps('kind')}
                  value={f.value}
                  options={PRODUCT_KINDS.map(k => ({value: k, label: k}))}
                  onValueChange={v => {
                    f.onChange(v)
                    // Duration is hidden for other kinds; a leftover value would fail validation there.
                    if (v !== 'TIMED') setValue('durationDays', '')
                  }}
                />
              )}
            />
          )}
          {values.kind === 'TIMED' &&
            field(
              'durationDays',
              t('durationDays'),
              <Input
                inputMode="numeric"
                {...fieldProps('durationDays')}
                {...register('durationDays')}
              />
            )}
          {field(
            'icon',
            t('icon'),
            <Controller
              control={control}
              name="icon"
              render={({field: f}) => (
                <Select
                  {...fieldProps('icon')}
                  value={f.value}
                  options={PRODUCT_ICONS.map(i => ({value: i, label: i}))}
                  onValueChange={f.onChange}
                />
              )}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            <Controller
              control={control}
              name="isActive"
              render={({field: f}) => (
                <Checkbox
                  id={fieldId('isActive')}
                  ref={f.ref}
                  checked={f.value}
                  // An enabled product keeps its checkbox, so it can always be unticked.
                  disabled={incomplete && !f.value}
                  aria-invalid={activeError ? true : undefined}
                  aria-describedby={activeError ? `${fieldId('isActive')}-error` : undefined}
                  onBlur={f.onBlur}
                  onCheckedChange={checked => {
                    f.onChange(checked === true)
                  }}
                />
              )}
            />
            <Label htmlFor={fieldId('isActive')}>{t('enabled')}</Label>
            {activeError && (
              <p id={`${fieldId('isActive')}-error`} className="w-full text-xs text-destructive">
                {activeError}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection
          title={t('prices')}
          description={t('bothCurrenciesAreNeededToEnable')}
          disabled={!canEdit}>
          {field(
            'prices.EUR',
            t('priceEUR'),
            <Input inputMode="decimal" {...fieldProps('prices.EUR')} {...register('prices.EUR')} />
          )}
          {field(
            'prices.PLN',
            t('pricePLN'),
            <Input inputMode="decimal" {...fieldProps('prices.PLN')} {...register('prices.PLN')} />
          )}
        </FormSection>

        <FormSection title={t('texts')} description={t('whatBuyersReadPerLanguage')}>
          <Tabs
            className="md:col-span-2"
            value={tab}
            onValueChange={value => {
              setTab(value as 'en' | 'pl')
            }}>
            <TabsList>
              {LOCALES.map(({locale, tab: label}) => (
                <TabsTrigger
                  key={locale}
                  value={locale}
                  onClick={() => {
                    setTab(locale)
                  }}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOCALES.map(({locale, tab: label}) => (
              <TabsContent key={locale} value={locale}>
                {/* Triggers stay outside the fieldset so a read-only admin can still switch tabs. */}
                <fieldset disabled={!canEdit} className="flex flex-col gap-4">
                  {field(
                    `translations.${locale}.name`,
                    t('nameIn', {locale: label}),
                    <Input
                      {...fieldProps(`translations.${locale}.name`)}
                      {...register(`translations.${locale}.name`)}
                    />
                  )}
                  {field(
                    `translations.${locale}.description`,
                    t('descriptionIn', {locale: label}),
                    <Controller
                      control={control}
                      name={`translations.${locale}.description`}
                      render={({field: input}) => (
                        <RichTextField
                          {...fieldProps(`translations.${locale}.description`)}
                          aria-labelledby={`${fieldId(`translations.${locale}.description`)}-label`}
                          value={input.value || ''}
                          onChange={input.onChange}
                          multiline
                          disabled={!canEdit}
                        />
                      )}
                    />
                  )}
                  <SectionsEditor
                    locale={locale}
                    control={control}
                    register={register}
                    disabled={!canEdit}
                  />
                </fieldset>
              </TabsContent>
            ))}
          </Tabs>
        </FormSection>

        <FormSection
          title={t('commands')}
          description={t('runOverRconWhenTheOrder')}
          disabled={!canEdit}>
          {field(
            'grant',
            t('grantCommands'),
            <Textarea className="font-mono" {...fieldProps('grant')} {...commandProps('grant')} />,
            t('commandHint'),
            true
          )}
          {field(
            'revoke',
            t('revokeCommands'),
            <Textarea
              className="font-mono"
              {...fieldProps('revoke')}
              {...commandProps('revoke')}
            />,
            t('commandHint'),
            true
          )}
          <CommandHelp onInsert={insertToken} />
        </FormSection>

        {canEdit && (
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
    </EditorLayout>
  )
}

const fieldId = (name: string) => `product-${name.replace(/\./g, '-')}`

function Field({
  name,
  label,
  error,
  hint,
  className,
  children
}: {
  name: string
  label: string
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <Label
        id={`${fieldId(name)}-label`}
        htmlFor={fieldId(name)}
        onClick={() => document.getElementById(fieldId(name))?.focus()}>
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${fieldId(name)}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
