import {OnlineDot} from '@/components/online-dot'
import {ProductPlate} from '@/features/catalog/components/product-plate'
import {findProduct, findServer, formatPrice} from '@/lib/catalog'
import {Plus} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import type {CSSProperties} from 'react'

// TEMP: placeholder purchases to preview the design. Remove when SSE arrives with the API.
export const STUB_PURCHASES = [
  {id: '1', player: 'Notch_fan', server: 'survival', slug: 'vip', minutesAgo: 1},
  {id: '2', player: 'Creeper77', server: 'survival', slug: 'starter-kit', minutesAgo: 3},
  {id: '3', player: 'xX_Alex_Xx', server: 'anarchy', slug: 'warlord', minutesAgo: 6},
  {id: '4', player: 'Steve2012', server: 'survival', slug: 'mythic-case', minutesAgo: 9},
  {id: '5', player: 'EnderQueen', server: 'minigames', slug: 'champion', minutesAgo: 12},
  {id: '6', player: 'PixelBaker', server: 'survival', slug: 'coins-5000', minutesAgo: 17},
  {id: '7', player: 'Zombie_Rick', server: 'anarchy', slug: 'pvp-kit', minutesAgo: 24},
  {id: '8', player: 'Kasia_PL', server: 'minigames', slug: 'cosmetic-case', minutesAgo: 31},
  {id: '9', player: 'RedstoneRay', server: 'survival', slug: 'legend', minutesAgo: 44},
  {id: '10', player: 'Golem_99', server: 'anarchy', slug: 'chaos-case', minutesAgo: 58}
].flatMap(({server, slug, ...rest}) => {
  const product = findProduct(server, slug)
  const owner = findServer(server)
  return product && owner
    ? [{...rest, product, accent: owner.accent, onAccent: owner.onAccent}]
    : []
})

type Purchase = (typeof STUB_PURCHASES)[number]

/** Below this many purchases a looping marquee would repeat the same donors, so the row stays still. */
const MARQUEE_MIN = 6

function Item({purchase: p}: {purchase: Purchase}) {
  const locale = useLocale()
  const ago = new Intl.RelativeTimeFormat(locale, {numeric: 'auto', style: 'short'})
  return (
    <li
      style={{'--accent': p.accent, '--on-accent': p.onAccent} as CSSProperties}
      className="flex items-center gap-3">
      <span className="size-11 shrink-0 overflow-hidden rounded-[12px]">
        <ProductPlate product={p.product} size="thumb" />
      </span>
      <span className="flex max-w-[190px] min-w-0 flex-col">
        <span className="truncate text-sm leading-tight font-semibold">{p.player}</span>
        <span className="truncate text-xs text-muted">
          {p.product.name} · {ago.format(-p.minutesAgo, 'minute')}
        </span>
      </span>
      <span className="font-display text-lg leading-none font-semibold text-accent tabular-nums">
        {formatPrice(p.product.price.EUR, 'EUR', locale)}
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

/** Purchase feed (SSE arrives with the API). Empty and short feeds sit still; a full one runs as a right-to-left marquee. */
export function LiveFeed({purchases = STUB_PURCHASES}: {purchases?: Purchase[]}) {
  const t = useTranslations('feed')
  const full = purchases.length >= MARQUEE_MIN
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
            <Row purchases={purchases} />
            <Row purchases={purchases} hidden />
          </div>
        </div>
      ) : (
        <ul className="mx-auto flex max-w-page flex-wrap items-center gap-x-12 gap-y-5 px-[var(--gutter)]">
          {purchases.map(p => (
            <Item key={p.id} purchase={p} />
          ))}
          {purchases.length === 0 && <Ghost label={t('empty')} />}
        </ul>
      )}
    </section>
  )
}
