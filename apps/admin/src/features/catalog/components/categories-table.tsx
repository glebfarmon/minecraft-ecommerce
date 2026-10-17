'use client'

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
import {useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@shop/ui/table'

export function CategoriesTable({canEdit}: {canEdit: boolean}) {
  const categories = useListCatalogCategoriesQuery()
  const [create, {isLoading: creating}] = useCreateCatalogCategoryMutation()
  const [update] = useUpdateCatalogCategoryMutation()
  const [remove] = useDeleteCatalogCategoryMutation()
  const [editing, setEditing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {register, handleSubmit, control, reset} = useForm({
    resolver: valibotResolver(CategoryFormSchema),
    defaultValues: {slug: '', en: '', pl: ''}
  })
  const {errors} = useFormState({control})

  if (categories.isLoading) return <p>Loading categories…</p>
  if (categories.isError) return <p role="alert">Could not load categories. Refresh the page.</p>

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

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>English</TableHead>
            <TableHead>Polish</TableHead>
            <TableHead>Servers</TableHead>
            <TableHead>Products</TableHead>
            {canEdit && <TableHead className="sr-only">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(categories.data ?? []).map(c =>
            editing === c.id ? (
              <EditRow
                key={c.id}
                category={c}
                onCancel={() => {
                  setEditing(null)
                }}
                onSave={async values => {
                  if (
                    await run(
                      update({
                        id: c.id,
                        body: {
                          slug: values.slug,
                          names: {en: values.en, pl: values.pl},
                          version: c.version
                        }
                      })
                    )
                  )
                    setEditing(null)
                }}
              />
            ) : (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                <TableCell>{c.names.en}</TableCell>
                <TableCell>{c.names.pl}</TableCell>
                <TableCell>{c.servers.map(s => s.name).join(', ') || '—'}</TableCell>
                <TableCell>{c.productCount}</TableCell>
                {canEdit && (
                  <TableCell className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(c.id)
                      }}>
                      Rename
                    </Button>
                    {confirming === c.id ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setConfirming(null)
                          void run(remove({id: c.id, version: String(c.version)}))
                        }}>
                        Confirm delete
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setConfirming(c.id)
                        }}>
                        Delete
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
      {canEdit && (
        <form
          onSubmit={e => void onCreate(e)}
          className="flex flex-wrap items-end gap-3"
          noValidate>
          {(['slug', 'en', 'pl'] as const).map(field => (
            <div key={field} className="flex flex-col gap-1">
              <Label htmlFor={`new-${field}`}>
                {{slug: 'Slug', en: 'English name', pl: 'Polish name'}[field]}
              </Label>
              <Input
                id={`new-${field}`}
                aria-invalid={errors[field] ? true : undefined}
                aria-describedby={errors[field] ? `new-${field}-error` : undefined}
                {...register(field)}
              />
              {errors[field] && (
                <p id={`new-${field}-error`} className="text-xs text-destructive">
                  {errors[field].message}
                </p>
              )}
            </div>
          ))}
          <Button type="submit" disabled={creating}>
            Add category
          </Button>
        </form>
      )}
    </div>
  )
}

type Category = ListCatalogCategoriesApiResponse[number]

const EDIT_FIELDS = [
  {name: 'slug', label: 'Slug'},
  {name: 'en', label: 'English name'},
  {name: 'pl', label: 'Polish name'}
] as const

function EditRow({
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
  const save = handleSubmit(onSave)

  return (
    <TableRow>
      {EDIT_FIELDS.map(({name, label}) => (
        <TableCell key={name} className="align-top">
          <Input
            aria-label={label}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? `edit-${category.id}-${name}-error` : undefined}
            onKeyDown={e => {
              if (e.key === 'Enter') void save(e)
              if (e.key === 'Escape') onCancel()
            }}
            {...register(name)}
          />
          {errors[name] && (
            <p id={`edit-${category.id}-${name}-error`} className="mt-1 text-xs text-destructive">
              {errors[name].message}
            </p>
          )}
        </TableCell>
      ))}
      <TableCell>{category.servers.map(s => s.name).join(', ') || '—'}</TableCell>
      <TableCell>{category.productCount}</TableCell>
      <TableCell className="flex gap-2">
        <Button disabled={isSubmitting} onClick={e => void save(e)}>
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </TableCell>
    </TableRow>
  )
}
