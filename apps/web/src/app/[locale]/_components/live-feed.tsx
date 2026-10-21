import {OnlineDot} from '@/components/online-dot'
import {ProductPlate} from '@/features/catalog/components/product-plate'
import {formatPrice} from '@/lib/catalog'
import {Plus} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import type {CSSProperties} from 'react'

import type {CatalogResponse} from '@shop/shared/catalog'
import type {RecentPurchase} from '@shop/shared/orders'

function purchases(catalog: CatalogResponse, recent: RecentPurchase[]) {
  const now = Date.now()
  return recent.flatMap(({server, product: slug, paidAt, ...rest}) => {
    const product = catalog.products.find(p => p.server === server && p.slug === slug)
    const owner = catalog.servers.find(s => s.slug === server)
    return product && owner
      ? [
          {
            ...rest,
            product,
            accent: owner.accent,
            onAccent: owner.onAccent,
            msAgo: Math.max(0, now - Date.parse(paidAt))
          }
        ]
      : []
  })
}

type Purchase = ReturnType<typeof purchases>[number]

const AGO_UNITS = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000]
] as const

/** `3 min ago`, `2 hr ago`, `yesterday`: the largest unit that fits, minutes at the least. */
function formatAgo(ms: number, locale: string) {
  const [unit, size] = AGO_UNITS.find(([, size]) => ms >= size) ?? AGO_UNITS[2]
  return new Intl.RelativeTimeFormat(locale, {numeric: 'auto', style: 'short'}).format(
    -Math.floor(ms / size),
    unit
  )
}

/** Below this many purchases a looping marquee would repeat the same donors, so the row stays still. */
const MARQUEE_MIN = 6

function Item({purchase: p}: {purchase: Purchase}) {
  const locale = useLocale()
  return (
    <li
      style={{'--accent': p.accent, '--on-accent': p.onAccent} as CSSProperties}
      className="flex items-center gap-3">
      <span className="size-11 shrink-0 overflow-hidden rounded-[12px]">
        <ProductPlate product={p.product} size="thumb" />
      </span>
      <span className="flex max-w-[190px] min-w-0 flex-col">
        <span className="truncate text-sm leading-tight font-semibold">{p.nick}</span>
        <span className="truncate text-xs text-muted">
          {p.product.name} · {formatAgo(p.msAgo, locale)}
        </span>
      </span>
      <span className="font-display text-lg leading-none font-semibold text-accent tabular-nums">
        {formatPrice(p.amountMinor, p.currency, locale)}
      </span>
    </li>
  )
}

/** Dashed stand-in shown when there are no purchases yet. */
function Ghost({label}: {label: string}) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-[12px] border border-dashed border-border text-muted">
        <Plus aria-hidden className="size-4" strokeWidth={2} />
      </span>
      <span className="text-sm text-muted">{label}</span>
    </li>
  )
}

function Row({purchases, hidden}: {purchases: Purchase[]; hidden?: boolean}) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 gap-12 pr-12">
      {purchases.map(p => (
        <Item key={p.id} purchase={p} />
      ))}
    </ul>
  )
}

/** Purchase feed of the latest paid orders. Empty and short feeds sit still; a full one runs as a right-to-left marquee. */
export function LiveFeed({
  catalog,
  recent
}: {
  catalog: CatalogResponse | null
  recent: RecentPurchase[]
}) {
  const t = useTranslations('feed')
  if (!catalog) return null
  const items = purchases(catalog, recent)
  const full = items.length >= MARQUEE_MIN
  return (
    <section aria-labelledby="feed-title" className="border-b border-line py-10">
      <h2
        id="feed-title"
        className="mx-auto mb-6 flex max-w-page items-center gap-3 px-[var(--gutter)] text-sm font-semibold">
        <OnlineDot online />
        {t('title')}
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] tracking-[0.14em] text-muted uppercase">
          {t('live')}
        </span>
      </h2>
      {full ? (
        <div className="feed-marquee overflow-hidden motion-reduce:overflow-x-auto">
          <div className="flex w-max animate-[feed-marquee_70s_linear_infinite] motion-reduce:animate-none">
            <Row purchases={items} />
            <Row purchases={items} hidden />
          </div>
        </div>
      ) : (
        <ul className="mx-auto flex max-w-page flex-wrap items-center gap-x-12 gap-y-5 px-[var(--gutter)]">
          {items.map(p => (
            <Item key={p.id} purchase={p} />
          ))}
          {items.length === 0 && <Ghost label={t('empty')} />}
        </ul>
      )}
    </section>
  )
}
