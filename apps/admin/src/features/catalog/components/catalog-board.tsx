'use client'

import {SkeletonRows} from '@/components/skeleton'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  type ListCatalogProductsApiResponse,
  type ListCatalogServersApiResponse,
  useListCatalogCategoriesQuery,
  useListCatalogProductsQuery,
  useListCatalogServersQuery,
  useOrderCatalogProductsMutation,
  useOrderCatalogServersMutation,
  useSetCatalogServerCategoriesMutation
} from '@/lib/api/generated'
import Link from 'next/link'
import {useState} from 'react'

import {Button} from '@shop/ui/button'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'

import {useOptimisticOrder} from '../lib/optimistic-order'
import {AddCard} from './add-card'
import {DragHandle} from './drag-handle'
import {ProductCard} from './product-card'
import {ServerCard} from './server-card'
import {SortableList} from './sortable-list'

type Server = ListCatalogServersApiResponse[number]
type Product = ListCatalogProductsApiResponse[number]

export function CatalogBoard({canEdit}: {canEdit: boolean}) {
  const servers = useListCatalogServersQuery()
  const [orderServers] = useOrderCatalogServersMutation()
  const tabs = useOptimisticOrder(servers.data ?? [], (ids, base) =>
    orderServers({body: {ids, base}})
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (servers.isLoading) return <SkeletonRows rows={4} />
  if (servers.isError) return <p role="alert">Could not load the catalog. Refresh the page.</p>
  const selected = tabs.items.find(s => s.id === selectedId) ?? tabs.items[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 overflow-x-auto p-1 pb-2">
        <div role="tablist" aria-label="Server">
          <SortableList
            label="Servers"
            direction="horizontal"
            disabled={!canEdit}
            items={tabs.items}
            className="gap-3"
            onMove={ids => void tabs.move(ids)}>
            {(s, handle) => (
              <ServerCard
                server={s}
                selected={s.id === selected?.id}
                onSelect={() => {
                  setSelectedId(s.id)
                }}
                handle={canEdit ? handle : undefined}
              />
            )}
          </SortableList>
        </div>
        {canEdit && (
          <AddCard href="/catalog/servers/new" label="+ Server" className="min-w-40 shrink-0" />
        )}
      </div>
      {tabs.error && <p role="alert">{tabs.error}</p>}
      {selected && <ServerColumn key={selected.id} server={selected} canEdit={canEdit} />}
    </div>
  )
}

function ServerColumn({server, canEdit}: {server: Server; canEdit: boolean}) {
  const [setCategories] = useSetCatalogServerCategoriesMutation()
  const allCategories = useListCatalogCategoriesQuery()
  const products = useListCatalogProductsQuery({serverId: server.id})
  const categories = useOptimisticOrder(server.categories, (categoryIds, base) =>
    setCategories({id: server.id, body: {categoryIds, base}})
  )
  const [error, setError] = useState<string | null>(null)
  const [attach, setAttach] = useState('')

  /** Attach or detach, starting from the list as shown; the API refuses it if that is out of date. */
  async function save(ids: string[]) {
    setError(null)
    const result = await setCategories({
      id: server.id,
      body: {categoryIds: ids, base: categories.base}
    })
    if (result.error) setError(apiErrorMessage(result.error))
  }

  const unattached = (allCategories.data ?? []).filter(
    c => !server.categories.some(sc => sc.id === c.id)
  )

  return (
    <section aria-label={server.name} className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h2 className="text-[20px] font-semibold">{server.name}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/catalog/servers/${server.id}`}>Server settings</Link>
        </Button>
      </div>
      {(error ?? categories.error) && <p role="alert">{error ?? categories.error}</p>}
      {products.isError && <p role="alert">Could not load products. Refresh the page.</p>}
      {categories.items.length === 0 ? (
        <p className="text-muted">No categories yet. Attach one below.</p>
      ) : (
        <SortableList
          label={`Categories of ${server.name}`}
          disabled={!canEdit}
          items={categories.items}
          className="flex flex-col gap-8"
          onMove={ids => void categories.move(ids)}>
          {(category, handle) => (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {canEdit && <DragHandle label={category.name} handle={handle} />}
                <h3 className="text-[15px] font-semibold">{category.name}</h3>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      aria-label={`Detach ${category.name}`}
                      onClick={() =>
                        void save(categories.items.filter(c => c.id !== category.id).map(c => c.id))
                      }>
                      Detach
                    </Button>
                  </>
                )}
              </div>
              <ProductList
                server={server}
                categoryId={category.id}
                categoryName={category.name}
                products={(products.data ?? []).filter(p => p.categoryId === category.id)}
                status={products.isLoading ? 'loading' : products.isError ? 'failed' : 'ready'}
                canEdit={canEdit}
              />
              {canEdit && (
                <AddCard
                  href={`/catalog/products/new?serverId=${server.id}&categoryId=${category.id}`}
                  label={`+ Product in ${category.name}`}
                  className="h-12"
                />
              )}
            </div>
          )}
        </SortableList>
      )}
      {canEdit && unattached.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={e => {
            e.preventDefault()
            if (attach) void save([...categories.items.map(c => c.id), attach])
            setAttach('')
          }}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="attach-category">Attach category</Label>
            <Select
              id="attach-category"
              value={attach}
              onChange={e => {
                setAttach(e.target.value)
              }}>
              <option value="">Choose…</option>
              {unattached.map(c => (
                <option key={c.id} value={c.id}>
                  {c.names.en}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={!attach}>
            Attach
          </Button>
        </form>
      )}
    </section>
  )
}

function ProductList({
  server,
  categoryId,
  categoryName,
  products,
  status,
  canEdit
}: {
  server: Server
  categoryId: string
  categoryName: string
  products: Product[]
  /** `failed` is explained once, above the categories. */
  status: 'loading' | 'failed' | 'ready'
  canEdit: boolean
}) {
  const [order] = useOrderCatalogProductsMutation()
  const list = useOptimisticOrder(products, (ids, base) =>
    order({serverId: server.id, categoryId, body: {ids, base}})
  )
  if (status === 'loading') return <p className="text-[13px] text-muted">Loading products…</p>
  if (status === 'failed') return null
  if (products.length === 0) return <p className="text-[13px] text-muted">No products.</p>
  return (
    <>
      {list.error && <p role="alert">{list.error}</p>}
      <SortableList
        label={`Products in ${categoryName}`}
        disabled={!canEdit}
        items={list.items}
        direction="grid"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        onMove={ids => void list.move(ids)}>
        {(p, handle) => (
          <ProductCard
            product={p}
            accent={server.accent}
            href={`/catalog/products/${p.id}`}
            handle={canEdit ? handle : undefined}
          />
        )}
      </SortableList>
    </>
  )
}
