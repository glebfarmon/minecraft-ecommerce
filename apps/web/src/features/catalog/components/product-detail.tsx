'use client'

import {MORPH_FADE} from '@/components/morph-content'
import type {Product} from '@/config/products'
import type {Server} from '@/config/servers'
import {useAddToCart} from '@/features/cart/components/add-to-cart'
import {useCart, useCurrency} from '@/features/cart/shop-provider'
import {ProductPlate} from '@/features/catalog/components/product-plate'
import {Block, SectionBlock} from '@/features/catalog/components/product-sections'
import {useScrollEdges} from '@/hooks/use-scroll-edges'
import type {Locale} from '@/i18n/routing'
import {formatPrice, productPlateLayoutId} from '@/lib/catalog'
import {Check, ShoppingBag} from 'lucide-react'
import {motion} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'
import {useRef} from 'react'

export function ProductDetail({
  product,
  server,
  titleId,
  onAdded
}: {
  product: Product
  server: Server
  titleId: string
  /** Called right after the product lands in the cart; the flight into the cart is the caller's to start. */
  onAdded: () => void
}) {
  const t = useTranslations('product')
  const tc = useTranslations('catalog')
  const locale = useLocale()
  const {currency} = useCurrency()
  const {lines} = useCart()
  const {added, addAndFlash} = useAddToCart(product)
  const scroller = useRef<HTMLDivElement>(null)
  const edges = useScrollEdges(scroller, 'y')
  const sections = product.sections?.[locale as Locale] ?? []
  const inCart = lines.some(l => l.product === product)

  const details = [
    {label: t('server'), value: server.name},
    {label: t('category'), value: tc(product.category)},
    {
      label: t('duration'),
      value: product.durationDays ? tc('days', {count: product.durationDays}) : tc('forever')
    }
  ]

  return (
    <div className="grid shrink-0 gap-4 md:h-[34rem] md:min-h-0 md:shrink md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-5">
      {/* The plate fills the left half on desktop and leads on mobile; the rest is one column that reads title, details, description, buy. */}
      <div className="shrink-0 max-md:order-1 md:col-start-1 md:row-start-1 md:min-h-0">
        <ProductPlate product={product} size="large" layoutId={productPlateLayoutId(product)} />
      </div>

      <div className="contents md:col-start-2 md:row-start-1 md:flex md:min-h-0 md:flex-col md:gap-4">
        <motion.h2
          {...MORPH_FADE}
          id={titleId}
          className="px-1 text-[clamp(2rem,5vw,2.75rem)] leading-[1] font-bold tracking-[-0.03em] max-md:order-2 md:pt-1 md:pr-12">
          {product.name}
        </motion.h2>

        <motion.div {...MORPH_FADE} className="max-md:order-3">
          <Block>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              {details.map(d => (
                <div key={d.label} className="min-w-0">
                  <dt className="truncate text-muted">{d.label}</dt>
                  <dd className="mt-1 font-medium">{d.value}</dd>
                </div>
              ))}
            </dl>
          </Block>
        </motion.div>

        {/* On desktop only the description scrolls; the title, details and buy bar stay put. */}
        <motion.div
          {...MORPH_FADE}
          ref={scroller}
          data-fade-start={edges.start}
          data-fade-end={edges.end}
          className="scroll-thin scroll-fade-y -mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 max-md:order-4 max-md:max-h-[min(15.75rem,36dvh)] md:[overscroll-behavior:contain]">
          {product.adult && (
            <Block title="18+" className="bg-accent-soft">
              <p className="text-sm leading-relaxed text-fg/85">
                {t('adultNote')} {t('fairNote')}
              </p>
            </Block>
          )}
          <Block title={t('description')}>
            <p className="leading-relaxed text-fg/85">{product.description[locale as Locale]}</p>
          </Block>
          {sections.map(section => (
            <SectionBlock key={section.title} section={section} />
          ))}
        </motion.div>

        <motion.div
          {...MORPH_FADE}
          className="flex items-center justify-between gap-4 border-t border-line pt-4 max-md:sticky max-md:-bottom-4 max-md:z-10 max-md:order-5 max-md:-mx-4 max-md:-mb-4 max-md:bg-surface max-md:px-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div>
            <p className="text-sm text-muted">{t('price')}</p>
            <p className="tabular mt-1 font-display text-3xl leading-none font-semibold">
              {formatPrice(product.price[currency], currency, locale)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              addAndFlash()
              onAdded()
            }}
            className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-on-accent transition-[filter] hover:brightness-110 sm:max-w-64">
            {added ? (
              <Check className="size-5 shrink-0" />
            ) : (
              <ShoppingBag className="size-5 shrink-0" />
            )}
            <span className="truncate">{inCart ? t('inCart') : t('addToCart')}</span>
          </button>
        </motion.div>
        <span aria-live="polite" className="sr-only">
          {added ? tc('added', {name: product.name}) : ''}
        </span>
      </div>
    </div>
  )
}
