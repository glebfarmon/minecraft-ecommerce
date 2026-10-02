'use client'

import {StepScroller} from '@/components/step-scroller'
import {ProductCard} from '@/features/catalog/components/product-card'
import {getPathname} from '@/i18n/navigation'
import type {CategoryId} from '@/lib/catalog'
import {categories, defaultServer, findServer, products, servers} from '@/lib/catalog'
import {AnimatePresence, MotionConfig, motion} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import type {CSSProperties} from 'react'

type Filter = CategoryId | 'all'

const EASE = [0.16, 1, 0.3, 1] as const
const FILTERS: Filter[] = ['all', ...categories]
const FADE = {
  initial: {opacity: 0, y: 12},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: -8}
}

/** The item `delta` places from `current`, wrapping around the ends. */
function cycle<T>(list: readonly T[], current: T, delta: number) {
  return list[(list.indexOf(current) + delta + list.length) % list.length]
}

export function Catalog({initialServer}: {initialServer: string}) {
  const t = useTranslations('catalog')
  const locale = useLocale()
  const [serverSlug, setServerSlug] = useState(initialServer)
  const [filter, setFilter] = useState<Filter>('all')

  const server = findServer(serverSlug) ?? defaultServer
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
    setServerSlug(slug)
    setFilter('all')
    // The server is a route segment, so build the URL with the router's locale rules (no prefix for the default locale).
    window.history.pushState(null, '', getPathname({locale, href: `/${slug}`}))
  }

  const step = (delta: number) => {
    const next = cycle(servers, server, delta)
    if (next) selectServer(next.slug)
  }
  const stepFilter = (delta: number) => {
    const next = cycle(FILTERS, filter, delta)
    if (next) setFilter(next)
  }

  return (
    <MotionConfig reducedMotion="user">
      <style>{`:root{--accent:${server.accent};--on-accent:${server.onAccent}}`}</style>
      <section
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
              initial={{opacity: 0, y: 80}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 80}}
              transition={{duration: 0.6, ease: EASE, delay: 0.15}}
              className="font-display text-[clamp(4.5rem,15vw,15rem)] leading-[0.85] font-bold whitespace-nowrap text-accent/[0.12] uppercase">
              {server.name}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="relative mx-auto grid max-w-[1440px] gap-x-6 gap-y-10 px-[var(--gutter)] py-24 lg:grid-cols-12 lg:py-32">
          <h2 id="shop-title" className="sr-only">
            {t('title')}
          </h2>

          {/* Server description */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-28">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={server.slug} {...FADE} transition={{duration: 0.4, ease: EASE}}>
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
              {servers.map(s => {
                const active = s.slug === server.slug
                return (
                  <button
                    key={s.slug}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      selectServer(s.slug)
                    }}
                    className={`h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-transparent bg-accent text-on-accent'
                        : 'border-border text-fg hover:border-white/30'
                    }`}>
                    {s.name}
                  </button>
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
              <CategoryList filter={filter} onChange={setFilter} layout="row" />
            </StepScroller>

            <div className="relative mt-10 lg:mt-16">
              <AnimatePresence mode="wait" initial={false}>
                <motion.ul
                  key={`${server.slug}:${filter}`}
                  className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 xl:grid-cols-3"
                  exit={{opacity: 0, y: -40}}
                  transition={{duration: 0.25, ease: EASE}}>
                  {items.map((product, i) => (
                    <motion.li
                      key={product.slug}
                      initial={{opacity: 0, y: 24, rotate: -2}}
                      animate={{opacity: 1, y: 0, rotate: 0}}
                      transition={{
                        duration: 0.5,
                        ease: EASE,
                        delay: 0.05 + i * 0.04
                      }}>
                      <ProductCard product={product} />
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
                      setFilter('all')
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
              <CategoryList filter={filter} onChange={setFilter} layout="column" />
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}

function CategoryList({
  filter,
  onChange,
  layout
}: {
  filter: Filter
  onChange: (f: Filter) => void
  layout: 'row' | 'column'
}) {
  const t = useTranslations('catalog')
  return (
    <ul
      role="list"
      aria-label={t('categories')}
      className={layout === 'row' ? 'flex gap-2' : 'flex flex-col gap-2'}>
      {FILTERS.map(option => {
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
    </ul>
  )
}
