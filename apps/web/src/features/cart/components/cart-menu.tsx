'use client'

import {CountUp} from '@/components/count-up'
import {MorphPopover} from '@/components/morph-popover'
import {MAX_QTY, useCart, useCartActions, useCurrency} from '@/features/cart/shop-provider'
import {formatPrice} from '@/lib/catalog'
import {Minus, Plus, ShoppingBag, X} from 'lucide-react'
import {AnimatePresence, motion} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'

// Cart numbers change by one step at a time, so they settle much faster than the online counter.
const TICK = 0.45

export function CartMenu() {
  const t = useTranslations('cart')
  const tNav = useTranslations('nav')
  const locale = useLocale()
  const {lines, count} = useCart()
  const {currency} = useCurrency()
  const {add, decrement, remove} = useCartActions()

  const total = lines.reduce((sum, l) => sum + l.product.price[currency] * l.qty, 0)

  return (
    <MorphPopover
      triggerLabel={t('label', {count})}
      panelLabel={t('title')}
      closeLabel={tNav('closePanel')}
      flyTarget
      triggerClassName="relative size-11 bg-fg text-ink"
      // Below lg the burger button sits to the right of the cart, so leave room for it (3.75rem).
      panelClassName="w-[min(22rem,calc(100vw-2*var(--gutter)-3.75rem))] max-h-[calc(100svh-6rem)] overflow-y-auto"
      trigger={
        <>
          <ShoppingBag className="size-[18px]" />
          {/* `initial={false}`: a badge already there when the trigger remounts (panel closing) must not pop again. */}
          <AnimatePresence initial={false}>
            {count > 0 && (
              <motion.span
                initial={{scale: 0, opacity: 0}}
                animate={{scale: 1, opacity: 1}}
                exit={{scale: 0, opacity: 0}}
                transition={{type: 'spring', duration: 0.35, bounce: 0.45}}
                className="tabular absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-on-accent">
                <CountUp value={count} duration={TICK} />
              </motion.span>
            )}
          </AnimatePresence>
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
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted capitalize">{product.server}</p>
                      {qty > 1 && (
                        <div className="mt-2 inline-flex items-center rounded-full bg-white/5">
                          <button
                            type="button"
                            onClick={() => {
                              decrement(product)
                            }}
                            aria-label={t('decrease', {name: product.name})}
                            className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-fg">
                            <Minus className="size-3.5" />
                          </button>
                          <span
                            data-testid="cart-qty"
                            aria-live="polite"
                            className="tabular min-w-6 text-center text-sm font-medium">
                            <CountUp value={qty} duration={TICK} />
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              add(product)
                            }}
                            disabled={qty >= MAX_QTY}
                            aria-label={t('increase', {name: product.name})}
                            className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-fg disabled:pointer-events-none disabled:opacity-40">
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="tabular text-sm">
                      <CountUp
                        key={currency}
                        value={product.price[currency] * qty}
                        duration={TICK}
                        format={n => formatPrice(n, currency, locale)}
                      />
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
                  <CountUp
                    key={currency}
                    value={total}
                    duration={TICK}
                    format={n => formatPrice(n, currency, locale)}
                  />
                </span>
              </div>
            </>
          )}
          <button
            type="button"
            disabled
            title={t('checkoutSoon')}
            className="mt-4 h-11 w-full rounded-full bg-accent font-semibold text-on-accent disabled:opacity-40">
            {t('checkout')}
          </button>
          <p className="mt-2 text-center text-xs text-muted">{t('checkoutSoon')}</p>
        </>
      )}
    </MorphPopover>
  )
}
