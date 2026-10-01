'use client'

import {useAddToCart} from '@/features/cart/components/add-to-cart'
import {useShop} from '@/features/cart/shop-provider'
import {ProductPlate} from '@/features/catalog/components/product-plate'
import type {Product, Server} from '@/lib/catalog'
import {formatPrice} from '@/lib/catalog'
import {Check, ShoppingBag} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

export function ProductDetail({
  product,
  server,
  titleId
}: {
  product: Product
  server: Server
  titleId: string
}) {
  const t = useTranslations('product')
  const tc = useTranslations('catalog')
  const locale = useLocale()
  const {currency, lines} = useShop()
  const {added, addToCart} = useAddToCart(product)
  const inCart = lines.some(l => l.product === product)

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <ProductPlate product={product} size="large" />
      <div className="flex flex-col">
        <h2
          id={titleId}
          className="text-[clamp(2.25rem,4vw,3.25rem)] leading-[1] font-bold tracking-[-0.03em]">
          {product.name}
        </h2>
        <p className="mt-4 leading-relaxed text-fg/80">
          {product.description[locale === 'pl' ? 'pl' : 'en']}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 text-sm">
          <div>
            <dt className="text-muted">{t('server')}</dt>
            <dd className="mt-1 font-medium">{server.name}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('category')}</dt>
            <dd className="mt-1 font-medium">{tc(product.category)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('duration')}</dt>
            <dd className="mt-1 font-medium">
              {product.durationDays ? tc('days', {count: product.durationDays}) : tc('forever')}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t('price')}</dt>
            <dd className="tabular mt-1 font-display text-2xl leading-none font-semibold">
              {formatPrice(product.price[currency], currency, locale)}
            </dd>
          </div>
        </dl>

        {product.adult && (
          <p className="mt-4 text-sm text-muted">
            {t('adultNote')} {t('fairNote')}
          </p>
        )}

        <button
          type="button"
          onClick={addToCart}
          className="mt-auto flex h-14 items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-on-accent transition-[filter] hover:brightness-110 max-md:mt-6">
          {added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}
          {inCart ? t('inCart') : t('addToCart')}
        </button>
        <span aria-live="polite" className="sr-only">
          {added ? tc('added', {name: product.name}) : ''}
        </span>
      </div>
    </div>
  )
}
