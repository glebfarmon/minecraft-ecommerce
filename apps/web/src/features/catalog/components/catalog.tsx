'use client'

import {StepScroller} from '@/components/step-scroller'
import {EASE} from '@/config/motion'
import type {Product} from '@/config/products'
import {products} from '@/config/products'
import type {CategoryId} from '@/config/servers'
import {defaultServer, servers} from '@/config/servers'
import {ProductCard} from '@/features/catalog/components/product-card'
import {ProductModal} from '@/features/catalog/components/product-modal'
import {getPathname} from '@/i18n/navigation'
import {findServer, productLayoutId} from '@/lib/catalog'
import {flyToCart} from '@/lib/fly-to-cart'
import {AnimatePresence, MotionConfig, motion, useInView} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useRef, useState} from 'react'
import type {CSSProperties} from 'react'

type Filter = CategoryId | 'all'

const FADE = {
  initial: {opacity: 0, y: 12},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: -8}
}

// Poses before the first reveal.
const HIDDEN_WORD = {opacity: 0, y: 80}
const HIDDEN_PILL = {opacity: 0, x: -12}
const HIDDEN_ROW = {opacity: 0, y: 8}
const HIDDEN_CARD = {opacity: 0, y: 24, rotate: -2}

/** The item `delta` places from `current`, wrapping around the ends. */
function cycle<T>(list: readonly T[], current: T, delta: number) {
  return list[(list.indexOf(current) + delta + list.length) % list.length]
}

export function Catalog({initialServer}: {initialServer: string}) {
  const t = useTranslations('catalog')
  const locale = useLocale()
  // `selected` outlives `modalOpen` so the modal keeps its content while it animates out.
  const [selected, setSelected] = useState<Product | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // Added from the modal: the card flies into the cart once the modal has become the card again, not while the two are still morphing.
  const flyWhenClosed = useRef(false)
  const modalServer = selected ? findServer(selected.server) : undefined
  const [serverSlug, setServerSlug] = useState(initialServer)
  const [filter, setFilter] = useState<Filter>('all')
  // The entrance plays once, when the section first scrolls into view; until then everything holds its hidden pose.
  const sectionRef = useRef<HTMLElement>(null)
  const revealed = useInView(sectionRef, {once: true, margin: '0px 0px -20% 0px'})
  // Entrance delays stagger the first reveal only; once the player interacts, changes are immediate.
  const [interacted, setInteracted] = useState(false)
  const intro = (delay: number) => (interacted ? 0 : delay)

  const server = findServer(serverSlug) ?? defaultServer
  const filters: Filter[] = ['all', ...server.categories]
  const items = products.filter(
    p => p.server === server.slug && (filter === 'all' || p.category === filter)
  )

  // The navbar sits outside this section, so the page-wide accent is also set on :root.
  // The <style> below does it in the server HTML (no flash before hydration); the effect covers client-side switches.
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--accent', server.accent)
    root.setProperty('--on-accent', server.onAccent)
  }, [server])

  const selectServer = (slug: string) => {
    if (slug === server.slug) return
    setInteracted(true)
    setServerSlug(slug)
    setFilter('all')
    // The server is a route segment, so build the URL with the router's locale rules (no prefix for the default locale).
    window.history.pushState(null, '', getPathname({locale, href: `/${slug}`}))
  }

  const step = (delta: number) => {
    const next = cycle(servers, server, delta)
    if (next) selectServer(next.slug)
  }
  const changeFilter = (next: Filter) => {
    setInteracted(true)
    setFilter(next)
  }
  const stepFilter = (delta: number) => {
    const next = cycle(filters, filter, delta)
    if (next) changeFilter(next)
  }

  return (
    <MotionConfig reducedMotion="user">
      <style>{`:root{--accent:${server.accent};--on-accent:${server.onAccent}}`}</style>
      <section
        ref={sectionRef}
        id="shop"
        data-server={server.slug}
        aria-labelledby="shop-title"
        style={{'--accent': server.accent, '--on-accent': server.onAccent} as CSSProperties}
        className="relative overflow-x-clip border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-10 flex justify-center select-none lg:top-14">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={server.slug}
              initial={HIDDEN_WORD}
              animate={revealed ? {opacity: 1, y: 0} : HIDDEN_WORD}
              exit={HIDDEN_WORD}
              transition={{duration: 0.6, ease: EASE, delay: 0.15}}
              className="font-display text-[clamp(4.5rem,15vw,15rem)] leading-[0.85] font-bold whitespace-nowrap text-accent/[0.12] uppercase">
              {server.name}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="relative mx-auto grid max-w-page gap-x-6 gap-y-10 px-[var(--gutter)] py-24 lg:grid-cols-12 lg:py-32">
          <h2 id="shop-title" className="sr-only">
            {t('title')}
          </h2>

          {/* Server description */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-28">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={server.slug}
                  {...FADE}
                  animate={revealed ? FADE.animate : FADE.initial}
                  transition={{duration: 0.4, ease: EASE, delay: intro(0.1)}}>
                  <p className="text-[clamp(2.5rem,5vw,4rem)] leading-[0.95] font-bold tracking-[-0.03em]">
                    {server.name}
                  </p>
                  <p className="mt-5 max-w-[38ch] leading-relaxed text-fg/80">
                    {t(`descriptions.${server.slug}`)}
                  </p>
                </motion.div>
              </AnimatePresence>
              <p className="mt-8 max-w-[30ch] text-xs leading-relaxed text-muted">{t('demo')}</p>
            </div>
          </div>

          {/* Server switcher + products */}
          <div className="relative min-w-0 lg:col-span-6">
            <StepScroller
              label={t('servers')}
              prevLabel={t('prev')}
              nextLabel={t('next')}
              onPrev={() => {
                step(-1)
              }}
              onNext={() => {
                step(1)
              }}
              activeKey={server.slug}
              className="justify-start lg:justify-center">
              {servers.map((s, i) => {
                const active = s.slug === server.slug
                return (
                  <motion.button
                    key={s.slug}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      selectServer(s.slug)
                    }}
                    initial={HIDDEN_PILL}
                    animate={revealed ? {opacity: 1, x: 0} : HIDDEN_PILL}
                    transition={{duration: 0.4, ease: EASE, delay: 0.15 + i * 0.04}}
                    className={`h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-transparent bg-accent text-on-accent'
                        : 'border-border text-fg hover:border-white/30'
                    }`}>
                    {s.name}
                  </motion.button>
                )
              })}
            </StepScroller>

            {/* Categories as chips below lg */}
            <StepScroller
              label={t('categories')}
              prevLabel={t('prevCategory')}
              nextLabel={t('nextCategory')}
              onPrev={() => {
                stepFilter(-1)
              }}
              onNext={() => {
                stepFilter(1)
              }}
              activeKey={filter}
              className="mt-6 lg:hidden">
              <CategoryList
                key={server.slug}
                filters={filters}
                filter={filter}
                onChange={changeFilter}
                revealed={revealed}
                layout="row"
              />
            </StepScroller>

            <div className="relative mt-10 lg:mt-16">
              <AnimatePresence mode="wait" initial={false}>
                <motion.ul
                  key={`${server.slug}:${filter}`}
                  className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
                  exit={{opacity: 0, y: -40}}
                  transition={{duration: 0.25, ease: EASE}}>
                  {items.map((product, i) => (
                    <motion.li
                      key={product.slug}
                      initial={HIDDEN_CARD}
                      animate={revealed ? {opacity: 1, y: 0, rotate: 0} : HIDDEN_CARD}
                      transition={{
                        duration: 0.5,
                        ease: EASE,
                        delay: intro(0.3) + 0.05 + i * 0.04
                      }}>
                      <ProductCard
                        product={product}
                        open={modalOpen && selected === product}
                        onOpen={p => {
                          flyWhenClosed.current = false
                          setSelected(p)
                          setModalOpen(true)
                        }}
                      />
                    </motion.li>
                  ))}
                </motion.ul>
              </AnimatePresence>
              {items.length === 0 && (
                <div className="rounded-[var(--radius-card)] border border-dashed border-border px-6 py-16 text-center">
                  <p className="text-muted">{t('empty', {server: server.name})}</p>
                  <button
                    type="button"
                    onClick={() => {
                      changeFilter('all')
                    }}
                    className="mt-4 h-11 rounded-full border border-border px-5 text-sm font-semibold hover:border-white/30">
                    {t('showAll')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Categories column */}
          <div className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-28">
              <p className="mb-4 eyebrow">{`//${t('categories')}`}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={server.slug}
                  {...FADE}
                  animate={revealed ? FADE.animate : FADE.initial}
                  transition={{duration: 0.3, ease: EASE, delay: intro(0.25)}}>
                  <CategoryList
                    filters={filters}
                    filter={filter}
                    onChange={changeFilter}
                    revealed={revealed}
                    layout="column"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>
      {selected && modalServer && (
        <ProductModal
          product={selected}
          server={modalServer}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false)
          }}
          onAdded={() => {
            flyWhenClosed.current = true
            setModalOpen(false)
          }}
          onClosed={() => {
            if (!flyWhenClosed.current) return
            flyWhenClosed.current = false
            flyToCart(document.querySelector(`[data-product="${productLayoutId(selected)}"]`))
          }}
        />
      )}
    </MotionConfig>
  )
}

function CategoryList({
  filters,
  filter,
  onChange,
  revealed,
  layout
}: {
  filters: Filter[]
  filter: Filter
  onChange: (f: Filter) => void
  revealed: boolean
  layout: 'row' | 'column'
}) {
  const t = useTranslations('catalog')
  return (
    <motion.ul
      role="list"
      aria-label={t('categories')}
      // The column is faded by its parent; the row sits in a scroller, so it fades itself in when the server changes.
      initial={layout === 'row' ? HIDDEN_ROW : false}
      animate={revealed ? {opacity: 1, y: 0} : HIDDEN_ROW}
      transition={{duration: 0.3, ease: EASE, delay: layout === 'row' ? 0.25 : 0}}
      className={layout === 'row' ? 'flex gap-2' : 'flex flex-col gap-2'}>
      {filters.map(option => {
        const active = option === filter
        return (
          <li key={option}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChange(option)
              }}
              className={`flex h-12 items-center gap-3 rounded-full border px-5 text-[15px] font-medium transition-colors ${
                layout === 'column' ? 'w-full' : 'shrink-0 whitespace-nowrap'
              } ${active ? 'border-transparent bg-accent-soft text-fg' : 'border-border text-fg/80 hover:border-white/30 hover:text-fg'}`}>
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${active ? 'bg-accent' : 'bg-transparent'} ${
                  layout === 'row' ? 'hidden' : ''
                }`}
              />
              {t(option)}
            </button>
          </li>
        )
      })}
    </motion.ul>
  )
}
