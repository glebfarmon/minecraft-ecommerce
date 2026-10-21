'use client'

import {EmptyState} from '@/components/empty-state'
import {Hint} from '@/components/hint'
import {Skeleton} from '@/components/skeleton'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
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
import * as Menu from '@radix-ui/react-dropdown-menu'
import {Pencil, Plus, Tags} from 'lucide-react'
import {LayoutGroup} from 'motion/react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {type CSSProperties, type ReactNode, useState} from 'react'

import {Button} from '@shop/ui/button'

import {useOptimisticOrder} from '../lib/optimistic-order'
import {AddCard} from './add-card'
import {DragHandle} from './drag-handle'
import {ProductCard, ProductCardSkeleton} from './product-card'
import {ProductIcon} from './product-icon'
import {ServerCard, ServerCardSkeleton} from './server-card'
import {SortableList} from './sortable-list'

type Server = ListCatalogServersApiResponse[number]
type Product = ListCatalogProductsApiResponse[number]

const PRODUCT_GRID = 'grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'

/** `skeleton`: the route's loading state, the board's layout with placeholders. */
export function CatalogBoard({canEdit, skeleton = false}: {canEdit: boolean; skeleton?: boolean}) {
  const t = useTranslations('catalog')
  const servers = useListCatalogServersQuery()
  const [orderServers] = useOrderCatalogServersMutation()
  const tabs = useOptimisticOrder(servers.data ?? [], (ids, base) =>
    orderServers({body: {ids, base}})
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const held = useHoldLoading(servers.isLoading)
  if (held || skeleton) return <BoardLoading canEdit={canEdit} />
  if (servers.isError) return <p role="alert">{t('couldNotLoadTheCatalogRefresh')}</p>
  const selected = tabs.items.find(s => s.id === selectedId) ?? tabs.items[0]

  return (
    <div className="flex flex-col gap-6">
      {/* The scroll box clips on both axes: 8px of padding holds the selection ring (4px out plus
          a 2px line) and the focus ring; the negative margin keeps the cards on the page edge. */}
      <div className="-m-2 flex gap-3 overflow-x-auto p-2">
        <div role="tablist" aria-label={t('server')}>
          <LayoutGroup id="servers">
            <SortableList
              label={t('servers')}
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
                  editHref={canEdit ? `/catalog/servers/${s.id}` : undefined}
                />
              )}
            </SortableList>
          </LayoutGroup>
        </div>
        {canEdit && (
          <AddCard href="/catalog/servers/new" label={t('server2')} className="min-w-40 shrink-0" />
        )}
      </div>
      {tabs.error && <p role="alert">{tabs.error}</p>}
      {selected && <ServerColumn key={selected.id} server={selected} canEdit={canEdit} />}
    </div>
  )
}

function ServerColumn({server, canEdit}: {server: Server; canEdit: boolean}) {
  const t = useTranslations('catalog')
  const [setCategories] = useSetCatalogServerCategoriesMutation()
  const allCategories = useListCatalogCategoriesQuery()
  const products = useListCatalogProductsQuery({serverId: server.id})
  const categories = useOptimisticOrder(server.categories, (categoryIds, base) =>
    setCategories({id: server.id, body: {categoryIds, base}})
  )
  const [error, setError] = useMessage()
  const report = useReportError(setError)

  /** Attach or detach, starting from the list as shown; the API refuses it if that is out of date. */
  async function save(ids: string[]) {
    setError(null)
    const result = await setCategories({
      id: server.id,
      body: {categoryIds: ids, base: categories.base}
    })
    if (result.error) report(result.error)
  }

  const unattached = (allCategories.data ?? []).filter(
    c => !server.categories.some(sc => sc.id === c.id)
  )

  /** The list unfolds from the middle of its trigger, under where the admin clicked. */
  const attachMenu = (trigger: ReactNode) => (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="center"
          sideOffset={6}
          collisionPadding={16}
          className="menu-unfold z-50 w-72 max-w-[calc(100vw-2rem)] rounded-plate border border-border bg-card-raised p-1 shadow-xl shadow-black/40">
          {unattached.map((c, i) => (
            <Menu.Item
              key={c.id}
              style={{'--i': i} as CSSProperties}
              onSelect={() => void save([...categories.items.map(x => x.id), c.id])}
              className="menu-unfold-item flex h-9 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-[13px] text-fg outline-none data-[highlighted]:bg-card">
              <ProductIcon name={c.icon} className="size-4 shrink-0 text-muted" />
              <span className="truncate">{c.names.en}</span>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )

  return (
    <section aria-label={server.name} className="flex flex-col gap-6">
      <h2 className="text-[20px] font-semibold">{server.name}</h2>
      {(error ?? categories.error) && <p role="alert">{error ?? categories.error}</p>}
      {products.isError && <p role="alert">{t('couldNotLoadProductsRefreshThe')}</p>}
      {categories.items.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={t('noCategoriesOn', {name: server.name})}
          action={
            canEdit && (
              <div className="flex flex-col items-center gap-3">
                {unattached.length > 0 &&
                  attachMenu(
                    <Button variant="outline">
                      <Plus aria-hidden />
                      {t('attachCategory')}
                    </Button>
                  )}
                <Button asChild variant="outline">
                  <Link href="/catalog/categories">{t('createCategory')}</Link>
                </Button>
              </div>
            )
          }
        />
      ) : (
        <SortableList
          label={t('categoriesOf', {name: server.name})}
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
                    <Hint label={t('editCategory')}>
                      <Link
                        href={`/catalog/categories?edit=${category.id}`}
                        aria-label={t('editName', {name: category.name})}
                        className="grid size-7 place-items-center rounded-full text-muted hover:bg-card-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                        <Pencil aria-hidden className="size-4" />
                      </Link>
                    </Hint>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      aria-label={t('detachName', {name: category.name})}
                      onClick={() =>
                        void save(categories.items.filter(c => c.id !== category.id).map(c => c.id))
                      }>
                      {t('detach')}
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
                  label={t('productIn', {name: category.name})}
                  className="h-12"
                />
              )}
            </div>
          )}
        </SortableList>
      )}
      {canEdit &&
        unattached.length > 0 &&
        categories.items.length > 0 &&
        attachMenu(
          <button
            type="button"
            className="flex h-12 items-center justify-center gap-2 rounded-card border border-dashed border-border px-4 text-[13px] font-medium text-muted transition-colors hover:bg-card hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[state=open]:bg-card data-[state=open]:text-fg">
            <Plus aria-hidden className="size-4" />
            {t('attachCategory')}
          </button>
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
  const t = useTranslations('catalog')
  const [order] = useOrderCatalogProductsMutation()
  const list = useOptimisticOrder(products, (ids, base) =>
    order({serverId: server.id, categoryId, body: {ids, base}})
  )
  if (status === 'loading') return <ProductGridLoading />
  if (status === 'failed') return null
  if (products.length === 0) return <p className="text-[13px] text-muted">{t('noProducts')}</p>
  return (
    <>
      {list.error && <p role="alert">{list.error}</p>}
      <SortableList
        label={t('productsIn', {name: categoryName})}
        disabled={!canEdit}
        items={list.items}
        direction="grid"
        className={PRODUCT_GRID}
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

function ProductGridLoading() {
  const tc = useTranslations('common')
  return (
    <div role="status" className={PRODUCT_GRID}>
      <span className="sr-only">{tc('loading')}</span>
      {Array.from({length: 4}, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** The board as it will be: the server strip, then one server's first category and its products. */
function BoardLoading({canEdit}: {canEdit: boolean}) {
  const t = useTranslations('catalog')
  const tc = useTranslations('common')
  return (
    <div className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        {tc('loading')}
      </span>
      <div className="-m-2 flex gap-3 overflow-x-hidden p-2">
        {Array.from({length: 3}, (_, i) => (
          <ServerCardSkeleton key={i} />
        ))}
        {canEdit && (
          <AddCard href="/catalog/servers/new" label={t('server2')} className="min-w-40 shrink-0" />
        )}
      </div>
      <section aria-hidden className="flex flex-col gap-6">
        <Skeleton className="my-1 h-5 w-40 rounded-full" />
        <div className="flex flex-col gap-3">
          <div className="flex h-7 items-center gap-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            {canEdit && <Skeleton className="ml-auto h-4 w-14 rounded-full" />}
          </div>
          <ProductGridLoading />
          {canEdit && <div className="h-12 rounded-card border border-dashed border-border" />}
        </div>
      </section>
    </div>
  )
}
