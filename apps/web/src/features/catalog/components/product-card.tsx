'use client'

import {AddToCartButton} from '@/features/cart/components/add-to-cart'
import {useCurrency} from '@/features/cart/shop-provider'
import {ProductPlate} from '@/features/catalog/components/product-plate'
import type {Product} from '@/lib/catalog'
import {formatPrice} from '@/lib/catalog'
import {useLocale, useTranslations} from 'next-intl'

export function ProductCard({
  product,
  onOpen
}: {
  product: Product
  onOpen: (product: Product) => void
}) {
  const t = useTranslations('catalog')
  const locale = useLocale()
  const {currency} = useCurrency()

  return (
    <article className="group relative flex h-full flex-col rounded-[var(--radius-card)] bg-card p-2 transition-colors hover:bg-[#2a2a2e]">
      <ProductPlate product={product} />
      <div className="flex flex-1 flex-col px-4 pt-5 pb-4">
        <h3 className="line-clamp-2 text-xl leading-tight font-medium tracking-[-0.01em]">
          <button
            type="button"
            onClick={() => {
              onOpen(product)
            }}
            className="text-left after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent">
            {product.name}
          </button>
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t(product.category)}
          {product.durationDays ? ` · ${t('days', {count: product.durationDays})}` : ''}
        </p>
        <div className="mt-auto flex flex-col gap-4 pt-6">
          <span className="tabular font-display text-2xl leading-none font-semibold whitespace-nowrap">
            {formatPrice(product.price[currency], currency, locale)}
          </span>
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  )
}
