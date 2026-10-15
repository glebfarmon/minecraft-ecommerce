'use client'

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

import {fromMinor} from '@shop/shared/catalog-admin'
import {Button} from '@shop/ui/button'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'

import {useOptimisticOrder} from '../lib/optimistic-order'
import {type DragHandleProps, SortableList} from './sortable-list'

type Server = ListCatalogServersApiResponse[number]
type Product = ListCatalogProductsApiResponse[number]

function Handle({label, handle}: {label: string; handle: DragHandleProps}) {
  return (
    <button
      type="button"
      aria-label={`Move ${label}`}
      className="text-muted-foreground cursor-grab touch-none rounded px-1 hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
      {...handle}>
      ⠿
    </button>
  )
}

export function CatalogBoard({canEdit}: {canEdit: boolean}) {
  const servers = useListCatalogServersQuery()
  const [orderServers] = useOrderCatalogServersMutation()
  const tabs = useOptimisticOrder(servers.data ?? [], ids => orderServers({body: {ids}}))
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (servers.isLoading) return <p>Loading catalog…</p>
  if (servers.isError) return <p role="alert">Could not load the catalog. Refresh the page.</p>
  const selected = tabs.items.find(s => s.id === selectedId) ?? tabs.items[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Server">
          <SortableList
            label="Servers"
            direction="horizontal"
            disabled={!canEdit}
            items={tabs.items}
            className="gap-2"
            onMove={ids => void tabs.move(ids)}>
            {(s, handle) => (
              <span className="flex items-center gap-1 rounded-md border px-2 py-1">
                {canEdit && <Handle label={s.name} handle={handle} />}
                <button
                  type="button"
                  role="tab"
                  aria-selected={s.id === selected?.id}
                  onClick={() => {
                    setSelectedId(s.id)
                  }}
                  className="rounded px-2 py-1 text-sm aria-selected:font-semibold"
                  style={
                    s.id === selected?.id ? {background: s.accent, color: s.onAccent} : undefined
                  }>
                  {s.name}
                  {!s.isActive && <span className="ml-1 text-xs">(disabled)</span>}
                </button>
              </span>
            )}
          </SortableList>
        </div>
        {canEdit && (
          <Link href="/catalog/servers/new" className="text-sm underline">
            + Server
          </Link>
        )}
        <Link href="/catalog/categories" className="ml-auto text-sm underline">
          Manage categories
        </Link>
      </div>
      {tabs.error && <p role="alert">{tabs.error}</p>}
      {selected && <ServerColumn key={selected.id} server={selected} canEdit={canEdit} />}
      <p className="text-muted-foreground text-sm">Changes are live on the site within a minute.</p>
    </div>
  )
}

function ServerColumn({server, canEdit}: {server: Server; canEdit: boolean}) {
  const [setCategories] = useSetCatalogServerCategoriesMutation()
  const allCategories = useListCatalogCategoriesQuery()
  const products = useListCatalogProductsQuery({serverId: server.id})
  const categories = useOptimisticOrder(server.categories, ids =>
    setCategories({id: server.id, body: {categoryIds: ids}})
  )
  const [error, setError] = useState<string | null>(null)
  const [attach, setAttach] = useState('')

  async function save(ids: string[]) {
    setError(null)
    const result = await setCategories({id: server.id, body: {categoryIds: ids}})
    if (result.error) setError(apiErrorMessage(result.error))
  }

  const unattached = (allCategories.data ?? []).filter(
    c => !server.categories.some(sc => sc.id === c.id)
  )

  return (
    <section aria-label={server.name} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{server.name}</h2>
        <Link href={`/catalog/servers/${server.id}`} className="text-sm underline">
          Server settings
        </Link>
      </div>
      {(error ?? categories.error) && <p role="alert">{error ?? categories.error}</p>}
      {categories.items.length === 0 ? (
        <p className="text-muted-foreground">No categories yet. Attach one below.</p>
      ) : (
        <SortableList
          label={`Categories of ${server.name}`}
          disabled={!canEdit}
          items={categories.items}
          className="flex flex-col gap-4"
          onMove={ids => void categories.move(ids)}>
          {(category, handle) => (
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2">
                {canEdit && <Handle label={category.name} handle={handle} />}
                <h3 className="font-medium">{category.name}</h3>
                {canEdit && (
                  <>
                    <Link
                      href={`/catalog/products/new?serverId=${server.id}&categoryId=${category.id}`}
                      aria-label={`+ Product in ${category.name}`}
                      className="ml-auto text-sm underline">
                      + Product
                    </Link>
                    <Button
                      variant="outline"
                      aria-label={`Detach ${category.name}`}
                      onClick={() =>
                        void save(
                          server.categories.filter(c => c.id !== category.id).map(c => c.id)
                        )
                      }>
                      Detach
                    </Button>
                  </>
                )}
              </div>
              <ProductList
                serverId={server.id}
                categoryId={category.id}
                categoryName={category.name}
                products={(products.data ?? []).filter(p => p.categoryId === category.id)}
                canEdit={canEdit}
              />
            </div>
          )}
        </SortableList>
      )}
      {canEdit && unattached.length > 0 && (
        <form
          className="flex items-end gap-2"
          onSubmit={e => {
            e.preventDefault()
            if (attach) void save([...server.categories.map(c => c.id), attach])
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
  serverId,
  categoryId,
  categoryName,
  products,
  canEdit
}: {
  serverId: string
  categoryId: string
  categoryName: string
  products: Product[]
  canEdit: boolean
}) {
  const [order] = useOrderCatalogProductsMutation()
  const list = useOptimisticOrder(products, ids => order({serverId, categoryId, body: {ids}}))
  if (products.length === 0) return <p className="text-muted-foreground text-sm">No products.</p>
  return (
    <>
      {list.error && <p role="alert">{list.error}</p>}
      <SortableList
        label={`Products in ${categoryName}`}
        disabled={!canEdit}
        items={list.items}
        className="flex flex-col gap-1"
        onMove={ids => void list.move(ids)}>
        {(p, handle) => (
          <div className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
            {canEdit && <Handle label={p.name} handle={handle} />}
            <span className="text-muted-foreground w-12 truncate text-xs">
              {p.mark === p.name ? null : p.mark}
            </span>
            <Link href={`/catalog/products/${p.id}`} className="font-medium hover:underline">
              {p.name}
            </Link>
            <span className="ml-auto text-sm">
              {p.prices.EUR === null ? '—' : `${fromMinor(p.prices.EUR)} €`}
            </span>
            {!p.isActive && <span className="bg-muted rounded px-1.5 text-xs">Disabled</span>}
            {p.missing.length > 0 && (
              <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">Incomplete</span>
            )}
          </div>
        )}
      </SortableList>
    </>
  )
}
