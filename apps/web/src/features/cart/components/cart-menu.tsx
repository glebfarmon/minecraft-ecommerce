'use client'

import {MorphPopover} from '@/components/morph-popover'
import {useShop} from '@/features/cart/shop-provider'
import {formatPrice} from '@/lib/catalog'
import {ShoppingBag, X} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

export function CartMenu() {
  const t = useTranslations('cart')
  const tNav = useTranslations('nav')
  const locale = useLocale()
  const {lines, count, currency, remove} = useShop()

  const total = lines.reduce((sum, l) => sum + l.product.price[currency] * l.qty, 0)

  return (
    <MorphPopover
      triggerLabel={t('label', {count})}
      panelLabel={t('title')}
      closeLabel={tNav('closePanel')}
      triggerClassName="relative size-11 bg-fg text-ink"
      // Below lg the burger button sits to the right of the cart, so leave room for it (3.75rem).
      panelClassName="w-[min(22rem,calc(100vw-2*var(--gutter)-3.75rem))] max-h-[calc(100svh-6rem)] overflow-y-auto"
      trigger={
        <>
          <ShoppingBag className="size-[18px]" />
          {count > 0 && (
            <span className="tabular absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-on-accent">
              {count}
            </span>
          )}
        </>
      }>
      {() => (
        <>
          <p className="pr-10 text-sm font-semibold">{t('title')}</p>
          {lines.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t('empty')}</p>
          ) : (
            <>
              <ul className="mt-3 flex flex-col divide-y divide-line">
                {lines.map(({product, qty}) => (
                  <li
                    key={`${product.server}/${product.slug}`}
                    className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {product.name}
                        {qty > 1 && <span className="tabular text-muted"> ×{qty}</span>}
                      </p>
                      <p className="text-xs text-muted capitalize">{product.server}</p>
                    </div>
                    <span className="tabular text-sm">
                      {formatPrice(product.price[currency] * qty, currency, locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        remove(product)
                      }}
                      aria-label={t('remove', {name: product.name})}
                      className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-fg">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted">{t('total')}</span>
                <span className="tabular font-display text-xl font-semibold">
                  {formatPrice(total, currency, locale)}
                </span>
              </div>
            </>
          )}
          <button
            type="button"
            disabled
            title={t('checkoutSoon')}
            className="mt-4 h-11 w-full rounded-full bg-accent font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-40">
            {t('checkout')}
          </button>
          <p className="mt-2 text-center text-xs text-muted">{t('checkoutSoon')}</p>
        </>
      )}
    </MorphPopover>
  )
}
