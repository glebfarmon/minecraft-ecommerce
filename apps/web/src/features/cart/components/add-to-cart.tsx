'use client'

import {useCartActions} from '@/features/cart/shop-provider'
import {useTransientFlag} from '@/hooks/use-transient-flag'
import type {Product} from '@/lib/catalog'
import {Check, ShoppingBag} from 'lucide-react'
import {useTranslations} from 'next-intl'

export function useAddToCart(product: Product) {
  const {add} = useCartActions()
  const [added, flash] = useTransientFlag(1400)
  return {
    added,
    addToCart: () => {
      add(product)
      flash()
    }
  }
}

export function AddToCartIconButton({product}: {product: Product}) {
  const t = useTranslations('catalog')
  const {added, addToCart} = useAddToCart(product)
  return (
    <button
      type="button"
      onClick={addToCart}
      aria-label={t('add', {name: product.name})}
      className={`relative z-10 grid size-14 shrink-0 place-items-center rounded-[var(--radius-inner)] transition-[background-color,color,transform] duration-200 active:scale-95 ${
        added ? 'bg-accent text-on-accent' : 'bg-fg text-ink hover:bg-accent hover:text-on-accent'
      }`}>
      {added ? <Check className="size-5" strokeWidth={2.5} /> : <ShoppingBag className="size-5" />}
      <span aria-live="polite" className="sr-only">
        {added ? t('added', {name: product.name}) : ''}
      </span>
    </button>
  )
}
