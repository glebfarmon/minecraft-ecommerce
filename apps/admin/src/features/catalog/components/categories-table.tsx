'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {FormSection} from '@/components/form-section'
import {SkeletonRows} from '@/components/skeleton'
import {type CategoryForm, CategoryFormSchema} from '@/features/catalog/schemas'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  type ListCatalogCategoriesApiResponse,
  useCreateCatalogCategoryMutation,
  useDeleteCatalogCategoryMutation,
  useListCatalogCategoriesQuery,
  useUpdateCatalogCategoryMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {Tags} from 'lucide-react'
import {useState} from 'react'
import {type FieldErrors, type UseFormRegister, useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

/** `initialEdit` opens that category's form, e.g. from the catalog board's pencil. */
export function CategoriesTable({canEdit, initialEdit}: {canEdit: boolean; initialEdit?: string}) {
  const categories = useListCatalogCategoriesQuery()
  const [create, {isLoading: creating}] = useCreateCatalogCategoryMutation()
  const [update] = useUpdateCatalogCategoryMutation()
  const [remove] = useDeleteCatalogCategoryMutation()
  const [editing, setEditing] = useState<string | null>(initialEdit ?? null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {register, handleSubmit, control, reset} = useForm({
    resolver: valibotResolver(CategoryFormSchema),
    defaultValues: {slug: '', en: '', pl: ''}
  })
  const {errors} = useFormState({control})

  if (categories.isLoading) return <SkeletonRows />
  if (categories.isError)
    return (
      <p role="alert" className="rounded-card bg-card p-5">
        Could not load categories. Refresh the page.
      </p>
    )

  async function run(action: Promise<{error?: unknown}>) {
    setError(null)
    const result = await action
    if (result.error) setError(apiErrorMessage(result.error))
    return !result.error
  }

  const onCreate = handleSubmit(async values => {
    if (await run(create({body: {slug: values.slug, names: {en: values.en, pl: values.pl}}})))
      reset()
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
          <FormSection title="New category">
            <CategoryFields prefix="new" register={register} errors={errors} />
            <div className="md:col-span-2">
              <Button type="submit" disabled={creating}>
                Add category
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
                    version: editingCategory.version
                  }
                })
              )
            )
              setEditing(null)
          }}
        />
      )}
      {confirmingCategory && (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-card p-4">
          <p className="flex-1">Delete {confirmingCategory.names.en}?</p>
          <Button
            variant="danger"
            onClick={() => {
              setConfirming(null)
              void run(
                remove({id: confirmingCategory.id, version: String(confirmingCategory.version)})
              )
            }}>
            Confirm delete
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirming(null)
            }}>
            Cancel
          </Button>
        </div>
      )}
      <DataTable
        caption="Categories"
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
          {header: 'English', primary: true, cell: c => c.names.en},
          {header: 'Polish', cell: c => c.names.pl},
          {header: 'Slug', cell: c => c.slug, className: 'font-mono text-muted'},
          {header: 'Servers', cell: c => c.servers.map(sv => sv.name).join(', ') || '—'},
          {header: 'Products', cell: c => String(c.productCount), className: 'tabular'}
        ]}
        menu={
          canEdit
            ? c => [
                {
                  label: 'Edit',
                  onSelect: () => {
                    setConfirming(null)
                    setEditing(c.id)
                  }
                },
                {
                  label: 'Delete',
                  tone: 'danger',
                  onSelect: () => {
                    setEditing(null)
                    setConfirming(c.id)
                  }
                }
              ]
            : undefined
        }
        empty={<EmptyState icon={Tags} title="No categories yet." />}
      />
    </div>
  )
}

type Category = ListCatalogCategoriesApiResponse[number]

const FIELDS = [
  {name: 'slug', label: 'Slug'},
  {name: 'en', label: 'English name'},
  {name: 'pl', label: 'Polish name'}
] as const

function CategoryFields({
  prefix,
  register,
  errors
}: {
  prefix: string
  register: UseFormRegister<CategoryForm>
  errors: FieldErrors<CategoryForm>
}) {
  return FIELDS.map(({name, label}) => (
    <div key={name} className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={`${prefix}-${name}`}>{label}</Label>
      <Input
        id={`${prefix}-${name}`}
        className={name === 'slug' ? 'font-mono' : undefined}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${prefix}-${name}-error` : undefined}
        {...register(name)}
      />
      {errors[name] && (
        <p id={`${prefix}-${name}-error`} className="text-xs text-destructive">
          {errors[name].message}
        </p>
      )}
    </div>
  ))
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
  const {register, handleSubmit, control} = useForm({
    resolver: valibotResolver(CategoryFormSchema),
    defaultValues: {slug: category.slug, en: category.names.en, pl: category.names.pl}
  })
  const {errors, isSubmitting} = useFormState({control})

  return (
    <form
      noValidate
      onSubmit={e => void handleSubmit(onSave)(e)}
      onKeyDown={e => {
        if (e.key === 'Escape') onCancel()
      }}>
      <FormSection title={`Edit ${category.names.en}`}>
        <CategoryFields prefix={`edit-${category.id}`} register={register} errors={errors} />
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            Save
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </FormSection>
    </form>
  )
}
