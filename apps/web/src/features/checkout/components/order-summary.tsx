import type {Currency} from '@/config/currencies'
import type {Product} from '@/config/products'
import type {Server} from '@/config/servers'
import {findServer, formatPrice} from '@/lib/catalog'
import {Lock} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

type Line = {product: Product; qty: number}

/** Cart lines grouped by the server that delivers them, in cart order. */
function groupByServer(lines: Line[]) {
  const groups = new Map<string, {server: Server | undefined; lines: Line[]}>()
  for (const line of lines) {
    const group = groups.get(line.product.server)
    if (group) group.lines.push(line)
    else groups.set(line.product.server, {server: findServer(line.product.server), lines: [line]})
  }
  return [...groups.entries()]
}

export const orderTotal = (lines: Line[], currency: Currency) =>
  lines.reduce((sum, l) => sum + l.product.price[currency] * l.qty, 0)

/** Stays disabled until the orders API exists; the form around it already validates. */
function PayButton({total, className}: {total: string; className: string}) {
  const t = useTranslations('checkout')
  return (
    <button
      type="submit"
      disabled
      className={`flex h-14 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-on-accent transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:opacity-40 ${className}`}>
      <Lock className="size-5 shrink-0" aria-hidden="true" />
      {t('pay', {total})}
    </button>
  )
}

/**
 * Phones only: on a long form the Pay button would sit a scroll away, so the total and the button
 * stay pinned to the bottom of the modal (same pinning as the product modal's buy bar).
 */
export function PayBar({total, currency}: {total: number; currency: Currency}) {
  const t = useTranslations('checkout')
  const locale = useLocale()
  const money = formatPrice(total, currency, locale)
  return (
    <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 border-t border-line bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm text-muted">{t('total')}</p>
          <p className="tabular mt-1 font-display text-3xl leading-none font-semibold">{money}</p>
        </div>
        <PayButton total={money} className="min-w-0 flex-1" />
      </div>
    </div>
  )
}

export function OrderSummary({
  lines,
  currency,
  total,
  nick
}: {
  lines: Line[]
  currency: Currency
  total: number
  nick: string
}) {
  const t = useTranslations('checkout')
  const locale = useLocale()
  const money = (minor: number) => formatPrice(minor, currency, locale)

  return (
    <aside
      aria-label={t('summary')}
      // md:mt-11 drops the panel below the close button, level with the "Checkout" heading (the Back button above it is h-11).
      className="flex flex-col rounded-[var(--radius-inner)] bg-card p-5 md:sticky md:top-0 md:mt-11 md:self-start">
      <h3 className="text-lg font-semibold">{t('summary')}</h3>

      {/* The nickname is the one thing a typo ruins for good, so it is read back here, large. */}
      <div className="mt-4 border-b border-line pb-4">
        <p className="text-sm text-muted">{t('deliveringTo')}</p>
        <p
          data-testid="nick-preview"
          className={`mt-1 truncate font-mono text-xl font-medium ${nick ? 'text-fg' : 'text-muted'}`}>
          {nick || '—'}
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-4">
        {groupByServer(lines).map(([slug, group]) => (
          <li key={slug}>
            <p className="eyebrow-sm">{group.server?.name ?? slug}</p>
            <ul className="mt-1 flex flex-col divide-y divide-line">
              {group.lines.map(({product, qty}) => (
                <li
                  key={product.slug}
                  className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {product.name}
                    {qty > 1 && <span className="tabular ml-1.5 text-muted">×{qty}</span>}
                  </span>
                  <span className="tabular shrink-0">{money(product.price[currency] * qty)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-muted">{t('total')}</span>
        <span className="tabular font-display text-3xl leading-none font-semibold">
          {money(total)}
        </span>
      </div>

      {/* On phones the pinned bar carries the button. */}
      <PayButton total={money(total)} className="mt-5 w-full max-md:hidden" />
      <p className="mt-3 text-center text-xs text-muted">{t('payHint')}</p>
    </aside>
  )
}
