import {ToneDot} from '@/components/status-dot'
import type {
  ListCatalogProductsApiResponse,
  ListCatalogServersApiResponse
} from '@/lib/api/generated'
import {formatMoney} from '@/lib/format'
import Link from 'next/link'

import {fromMinor} from '@shop/shared/catalog-admin'

import {DragHandle} from './drag-handle'
import {ProductIcon} from './product-icon'
import type {DragHandleProps} from './sortable-list'

type Product = ListCatalogProductsApiResponse[number]
type Server = ListCatalogServersApiResponse[number]

const KIND: Record<Product['kind'], string> = {
  PERMANENT: 'Permanent',
  TIMED: 'Timed',
  CASE: 'Case'
}

function prices(p: Product) {
  const eur = p.prices.EUR === null ? '—' : formatMoney(p.prices.EUR, 'EUR')
  const pln = p.prices.PLN === null ? '—' : `${fromMinor(p.prices.PLN)} zł`
  return `${eur} · ${pln}`
}

export function ProductCard({
  product,
  server,
  href,
  handle
}: {
  product: Product
  server: Server
  href: string
  handle?: DragHandleProps
}) {
  return (
    <article className="group relative flex h-full flex-col gap-3 rounded-card bg-card p-3">
      <div
        className="relative grid aspect-[4/3] place-items-center rounded-plate"
        style={{
          background: `color-mix(in oklab, ${server.accent} 22%, transparent)`,
          color: server.accent
        }}>
        <ProductIcon name={product.icon} className="size-12" />
        {product.mark !== product.name && (
          <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-full bg-bg/70 px-2 py-0.5 font-mono text-[11px] text-fg">
            {product.mark}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 px-1 pb-1">
        <Link
          href={href}
          className="truncate rounded-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:outline-none">
          {product.name}
        </Link>
        <p className="tabular text-[13px] text-muted">{prices(product)}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex h-6 items-center rounded-full bg-card-raised px-2.5 text-[12px] text-muted">
            {KIND[product.kind]}
          </span>
          {!product.isActive && <ToneDot tone="idle" label="Disabled" />}
          {product.missing.length > 0 && <ToneDot tone="warn" label="Incomplete" />}
        </div>
      </div>
      {handle && (
        <DragHandle
          label={product.name}
          handle={handle}
          className="absolute top-2 right-2 bg-card/80 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        />
      )}
    </article>
  )
}
