import {ToneDot} from '@/components/status-dot'
import {useFormat} from '@/hooks/use-format'
import type {ListCatalogProductsApiResponse} from '@/lib/api/generated'
import {useTranslations} from 'next-intl'
import Link from 'next/link'

import {fromMinor} from '@shop/shared/catalog-admin'

import {DragHandle} from './drag-handle'
import {ProductIcon} from './product-icon'
import type {DragHandleProps} from './sortable-list'

type Product = ListCatalogProductsApiResponse[number]

function prices(p: Pick<Product, 'prices'>, money: (minor: number, currency: string) => string) {
  const eur = p.prices.EUR === null ? '—' : money(p.prices.EUR, 'EUR')
  const pln = p.prices.PLN === null ? '—' : `${fromMinor(p.prices.PLN)} zł`
  return `${eur} · ${pln}`
}

/** Without `href` (the editor's live preview) the name is plain text. */
export function ProductCard({
  product,
  accent,
  href,
  description,
  handle
}: {
  product: Pick<Product, 'name' | 'mark' | 'icon' | 'kind' | 'isActive' | 'prices' | 'missing'>
  accent: string
  href?: string
  /** Plain text; the editor's preview passes it, the board's cards do not. */
  description?: string
  handle?: DragHandleProps
}) {
  const t = useTranslations('catalog')
  const f = useFormat()
  return (
    <article className="group relative flex h-full flex-col gap-3 rounded-card bg-card p-3 transition-colors hover:bg-card-raised">
      <div
        className="relative grid aspect-[16/10] place-items-center rounded-plate"
        style={{
          background: `color-mix(in oklab, ${accent} 22%, transparent)`,
          color: accent
        }}>
        <ProductIcon name={product.icon} className="size-10" />
        {product.mark !== product.name && (
          <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-full bg-bg/70 px-2 py-0.5 font-mono text-[11px] text-fg">
            {product.mark}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 px-1 pb-1">
        {href ? (
          <Link
            href={href}
            className="truncate rounded-sm font-semibold after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">
            {product.name}
          </Link>
        ) : (
          <p className="truncate font-semibold">{product.name}</p>
        )}
        {description && <p className="line-clamp-2 text-[13px] text-muted">{description}</p>}
        <p className="tabular text-[13px] text-muted">{prices(product, f.money)}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex h-6 items-center rounded-full bg-card-raised px-2.5 text-[12px] text-muted">
            {t(`kind${product.kind}`)}
          </span>
          {!product.isActive && <ToneDot tone="idle" label={t('disabled')} />}
          {product.missing.length > 0 && <ToneDot tone="warn" label={t('incomplete')} />}
        </div>
      </div>
      {handle && (
        <DragHandle
          label={product.name}
          handle={handle}
          className="absolute top-2 right-2 z-10 bg-card/80 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        />
      )}
    </article>
  )
}
