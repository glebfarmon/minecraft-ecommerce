'use client'

import {CARD_RADIUS, MORPH} from '@/config/motion'
import {AddToCartButton} from '@/features/cart/components/add-to-cart'
import {useCurrency} from '@/features/cart/shop-provider'
import {useCatalog} from '@/features/catalog/catalog-provider'
import {ProductPlate} from '@/features/catalog/components/product-plate'
import {formatPrice, productLayoutId, productPlateLayoutId} from '@/lib/catalog'
import {motion} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'

import type {CatalogProduct} from '@shop/shared/catalog'

export function ProductCard({
  product,
  open = false,
  onOpen
}: {
  product: CatalogProduct
  /** This product's modal is open: it owns the card's surface, and the content steps aside. */
  open?: boolean
  onOpen: (product: CatalogProduct) => void
}) {
  const t = useTranslations('catalog')
  const locale = useLocale()
  const {currency} = useCurrency()
  const {categoryName} = useCatalog()

  return (
    <article data-product={productLayoutId(product)} className="group relative h-full">
      {/* The card's surface is its own layer, so the card can hand the box to the modal (shared layoutId) while its content, still in place, keeps the grid from reflowing. */}
      {!open && (
        <motion.div
          data-testid="product-card-surface"
          aria-hidden="true"
          layoutId={productLayoutId(product)}
          transition={MORPH}
          style={{borderRadius: CARD_RADIUS}}
          className="absolute inset-0 bg-card transition-colors group-hover:bg-[#2a2a2e]"
        />
      )}
      <div className="relative flex h-full flex-col p-2">
        {/* The plate carries over to the modal as a shared element of its own; an invisible copy holds its slot meanwhile (a different key remounts it, so the id has one owner at a time). */}
        <div className={open ? 'invisible' : undefined}>
          <ProductPlate
            key={open ? 'ghost' : 'live'}
            product={product}
            layoutId={open ? undefined : productPlateLayoutId(product)}
          />
        </div>
        <div
          className={`flex flex-1 flex-col px-4 pt-5 pb-4 transition-opacity ${
            open ? 'opacity-0 duration-100' : 'delay-200 duration-200'
          }`}>
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
            {categoryName(product.category)}
            {product.durationDays ? ` · ${t('days', {count: product.durationDays})}` : ''}
          </p>
          <div className="mt-auto flex flex-col gap-4 pt-6">
            <span className="tabular font-display text-2xl leading-none font-semibold whitespace-nowrap">
              {formatPrice(product.prices[currency], currency, locale)}
            </span>
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </article>
  )
}
