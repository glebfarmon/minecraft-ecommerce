'use client'

import {AddToCartIconButton} from '@/features/cart/components/add-to-cart'
import {useShop} from '@/features/cart/shop-provider'
import {ProductPlate} from '@/features/catalog/components/product-plate'
import {Link} from '@/i18n/navigation'
import type {Product} from '@/lib/catalog'
import {formatPrice} from '@/lib/catalog'
import {useLocale, useTranslations} from 'next-intl'

export function ProductCard({product}: {product: Product}) {
  const t = useTranslations('catalog')
  const locale = useLocale()
  const {currency} = useShop()

  return (
    <article className="group relative flex h-full flex-col rounded-[var(--radius-card)] bg-card p-2 transition-colors hover:bg-[#2a2a2e]">
      <ProductPlate product={product} />
      <div className="flex flex-1 flex-col px-3 pt-4 pb-2">
        <h3 className="truncate text-[1.375rem] leading-tight font-medium tracking-[-0.01em]">
          <Link
            href={`/${product.server}/${product.slug}`}
            scroll={false}
            className="after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t(product.category)}
          {product.durationDays ? ` · ${t('days', {count: product.durationDays})}` : ''}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="tabular font-display text-[2rem] leading-none font-semibold">
            {formatPrice(product.price[currency], currency, locale)}
          </span>
          <AddToCartIconButton product={product} />
        </div>
      </div>
    </article>
  )
}
