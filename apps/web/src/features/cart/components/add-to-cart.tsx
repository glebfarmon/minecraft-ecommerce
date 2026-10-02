'use client'

import {ADDED_FLASH_MS} from '@/config/cart'
import type {Product} from '@/config/products'
import {useCartActions} from '@/features/cart/shop-provider'
import {useTransientFlag} from '@/hooks/use-transient-flag'
import {flyToCart} from '@/lib/fly-to-cart'
import {Check, ShoppingBag} from 'lucide-react'
import {useTranslations} from 'next-intl'

export function useAddToCart(product: Product) {
  const {add} = useCartActions()
  const [added, flash] = useTransientFlag(ADDED_FLASH_MS)
  return {
    added,
    /** `source` is the element that visually jumps into the cart. */
    addToCart: (source?: Element | null) => {
      add(product)
      flash()
      flyToCart(source ?? null)
    }
  }
}

export function AddToCartButton({product}: {product: Product}) {
  const t = useTranslations('catalog')
  const {added, addToCart} = useAddToCart(product)
  return (
    <button
      type="button"
      onClick={e => {
        addToCart(e.currentTarget.closest('article'))
      }}
      aria-label={t('add', {name: product.name})}
      className={`relative z-10 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-inner)] text-sm font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.98] ${
        added ? 'bg-accent text-on-accent' : 'bg-fg/10 text-fg hover:bg-accent hover:text-on-accent'
      }`}>
      {added ? <Check className="size-4" strokeWidth={2.5} /> : <ShoppingBag className="size-4" />}
      {t('addShort')}
      <span aria-live="polite" className="sr-only">
        {added ? t('added', {name: product.name}) : ''}
      </span>
    </button>
  )
}
