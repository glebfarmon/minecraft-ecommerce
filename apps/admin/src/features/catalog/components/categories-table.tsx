'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {FormSection} from '@/components/form-section'
import {SkeletonRows} from '@/components/skeleton'
import {notify} from '@/components/toaster'
import {type CategoryForm, CategoryFormSchema} from '@/features/catalog/schemas'
import {useErrorText} from '@/hooks/use-error-text'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {
  type ListCatalogCategoriesApiResponse,
  useCreateCatalogCategoryMutation,
  useDeleteCatalogCategoryMutation,
  useListCatalogCategoriesQuery,
  useUpdateCatalogCategoryMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {Tags} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {
  type Control,
  Controller,
  type FieldErrors,
  type UseFormRegister,
  useForm,
  useFormState
} from 'react-hook-form'

import {PRODUCT_ICONS} from '@shop/shared/catalog'
import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'

import {ProductIcon} from './product-icon'

/** `initialEdit` opens that category's form, e.g. from the catalog board's pencil. */
export function CategoriesTable({canEdit, initialEdit}: {canEdit: boolean; initialEdit?: string}) {
  const t = useTranslations('catalog')
  const categories = useListCatalogCategoriesQuery()
  const [create, {isLoading: creating}] = useCreateCatalogCategoryMutation()
  const [update] = useUpdateCatalogCategoryMutation()
  const [remove] = useDeleteCatalogCategoryMutation()
  const [editing, setEditing] = useState<string | null>(initialEdit ?? null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useMessage()
  const report = useReportError(setError)
  const {register, handleSubmit, control, reset} = useForm({
    resolver: valibotResolver(CategoryFormSchema),
    defaultValues: {slug: '', en: '', pl: '', icon: 'crown' as const}
  })
  const {errors} = useFormState({control})

  const held = useHoldLoading(categories.isLoading)
  if (held) return <SkeletonRows />
  if (categories.isError)
    return (
      <p role="alert" className="rounded-card bg-card p-5">
        {t('couldNotLoadCategoriesRefreshThe')}
      </p>
    )

  async function run(action: Promise<{error?: unknown}>, done: string) {
    setError(null)
    const result = await action
    if (result.error) report(result.error)
    else notify.ok(done)
    return !result.error
  }

  const onCreate = handleSubmit(async values => {
    const body = {slug: values.slug, names: {en: values.en, pl: values.pl}, icon: values.icon}
    if (await run(create({body}), t('categorySaved'))) reset()
  })

  const list = categories.data ?? []
  const editingCategory = list.find(c => c.id === editing)
  const confirmingCategory = list.find(c => c.id === confirming)

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
          {error}
        </p>
      )}
      {canEdit && !editingCategory && (
        <form onSubmit={e => void onCreate(e)} noValidate>
          <FormSection title={t('newCategory')}>
            <CategoryFields prefix="new" register={register} control={control} errors={errors} />
            <div className="md:col-span-2">
              <Button type="submit" disabled={creating}>
                {t('addCategory')}
              </Button>
            </div>
          </FormSection>
        </form>
      )}
      {editingCategory && (
        <EditForm
          key={editingCategory.id}
          category={editingCategory}
          onCancel={() => {
            setEditing(null)
          }}
          onSave={async values => {
            if (
              await run(
                update({
                  id: editingCategory.id,
                  body: {
                    slug: values.slug,
                    names: {en: values.en, pl: values.pl},
                    icon: values.icon,
                    version: editingCategory.version
                  }
                }),
                t('categorySaved')
              )
            )
              setEditing(null)
          }}
        />
      )}
      {confirmingCategory && (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-card p-4">
          <p className="flex-1">{t('deleteName', {name: confirmingCategory.names.en})}</p>
          <Button
            variant="danger"
            onClick={() => {
              setConfirming(null)
              void run(
                remove({id: confirmingCategory.id, version: String(confirmingCategory.version)}),
                t('categoryDeleted')
              )
            }}>
            {t('confirmDelete')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirming(null)
            }}>
            {t('cancel')}
          </Button>
        </div>
      )}
      <DataTable
        caption={t('categories')}
        rows={list}
        rowKey={c => c.id}
        rowLabel={c => c.names.en}
        onRowClick={
          canEdit
            ? c => {
                setConfirming(null)
                setEditing(c.id)
              }
            : undefined
        }
        columns={[
          {header: t('english'), primary: true, cell: c => c.names.en},
          {header: t('polish'), cell: c => c.names.pl},
          {header: t('slug'), cell: c => c.slug, className: 'font-mono text-muted'},
          {header: t('servers'), cell: c => c.servers.map(sv => sv.name).join(', ') || '—'},
          {header: t('products'), cell: c => String(c.productCount), className: 'tabular'}
        ]}
        menu={
          canEdit
            ? c => [
                {
                  label: t('edit'),
                  onSelect: () => {
                    setConfirming(null)
                    setEditing(c.id)
                  }
                },
                {
                  label: t('delete'),
                  tone: 'danger',
                  onSelect: () => {
                    setEditing(null)
                    setConfirming(c.id)
                  }
                }
              ]
            : undefined
        }
        empty={<EmptyState icon={Tags} title={t('noCategoriesYet')} />}
      />
    </div>
  )
}

type Category = ListCatalogCategoriesApiResponse[number]

const FIELDS = [
  {name: 'slug', label: 'slug'},
  {name: 'en', label: 'englishName'},
  {name: 'pl', label: 'polishName'}
] as const

function CategoryFields({
  prefix,
  register,
  control,
  errors
}: {
  prefix: string
  register: UseFormRegister<CategoryForm>
  control: Control<CategoryForm>
  errors: FieldErrors<CategoryForm>
}) {
  const t = useTranslations('catalog')
  const errorText = useErrorText()
  const iconOptions = PRODUCT_ICONS.map(i => ({
    value: i,
    label: t(`icons.${i}`),
    icon: <ProductIcon name={i} className="size-4 shrink-0" />
  }))
  const texts = FIELDS.map(({name, label}) => (
    <div key={name} className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={`${prefix}-${name}`}>{t(label)}</Label>
      <Input
        id={`${prefix}-${name}`}
        className={name === 'slug' ? 'font-mono' : undefined}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${prefix}-${name}-error` : undefined}
        {...register(name)}
      />
      {errors[name] && (
        <p id={`${prefix}-${name}-error`} className="text-xs text-destructive">
          {errorText(errors[name].message)}
        </p>
      )}
    </div>
  ))
  return (
    <>
      {texts}
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={`${prefix}-icon`}>{t('icon')}</Label>
        <Controller
          control={control}
          name="icon"
          render={({field: f}) => (
            <Select
              id={`${prefix}-icon`}
              value={f.value}
              options={iconOptions}
              onValueChange={f.onChange}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">{t('iconOnEveryTile')}</p>
      </div>
    </>
  )
}

function EditForm({
  category,
  onSave,
  onCancel
}: {
  category: Category
  onSave: (values: CategoryForm) => Promise<void>
  onCancel: () => void
}) {
  const t = useTranslations('catalog')
  const {register, handleSubmit, control} = useForm({
    resolver: valibotResolver(CategoryFormSchema),
    defaultValues: {
      slug: category.slug,
      en: category.names.en,
      pl: category.names.pl,
      icon: category.icon
    }
  })
  const {errors, isSubmitting} = useFormState({control})

  return (
    <form
      noValidate
      onSubmit={e => void handleSubmit(onSave)(e)}
      onKeyDown={e => {
        if (e.key === 'Escape') onCancel()
      }}>
      <FormSection title={t('editName', {name: category.names.en})}>
        <CategoryFields
          prefix={`edit-${category.id}`}
          register={register}
          control={control}
          errors={errors}
        />
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            {t('save')}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
        </div>
      </FormSection>
    </form>
  )
}
