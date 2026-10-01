'use client'

import {OnlineDot} from '@/components/online-dot'
import {useShop} from '@/components/shop-provider'
import {Link, usePathname, useRouter} from '@/i18n/navigation'
import {routing} from '@/i18n/routing'
import type {Currency} from '@/lib/catalog'
import {formatPrice, networkOnline} from '@/lib/catalog'
import {useDismiss} from '@/lib/use-dismiss'
import {Check, ChevronDown, Globe, Menu, ShoppingBag, X} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {useCallback, useEffect, useRef, useState} from 'react'

const LANGUAGE_NAMES: Record<string, string> = {en: 'English', pl: 'Polski'}
const CURRENCIES: {code: Currency; symbol: string}[] = [
  {code: 'EUR', symbol: '€'},
  {code: 'PLN', symbol: 'zł'}
]

export function Navbar() {
  const t = useTranslations('nav')
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    {href: '/#top', label: t('home')},
    {href: '/#fair', label: t('cases')},
    {href: '/#faq', label: t('rules')},
    {href: '/#footer', label: t('contacts')}
  ]

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-[var(--gutter)] pt-4">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 rounded-full border border-border bg-surface/80 pr-2 pl-6 backdrop-blur-md">
        <Link href="/" className="font-display text-xl font-bold tracking-wide uppercase">
          Block<span className="text-accent">haus</span>
        </Link>

        <ul className="mx-auto hidden items-center gap-8 lg:flex">
          {links.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[13px] font-semibold tracking-[0.14em] text-muted uppercase transition-colors hover:text-fg">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <span className="tabular hidden items-center gap-2 px-3 text-sm text-muted sm:flex">
            <OnlineDot online />
            {t('online', {count: networkOnline})}
          </span>
          <div className="hidden sm:block">
            <SettingsMenu />
          </div>
          <CartButton />
          <button
            type="button"
            onClick={() => {
              setMenuOpen(true)
            }}
            className="grid size-11 place-items-center rounded-full text-fg hover:bg-white/5 lg:hidden"
            aria-label={t('menu')}
            aria-expanded={menuOpen}>
            <Menu className="size-5" />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg px-[var(--gutter)] pt-4 pb-8 lg:hidden">
          <div className="flex h-16 items-center justify-between pl-6">
            <span className="font-display text-xl font-bold tracking-wide uppercase">
              Block<span className="text-accent">haus</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
              }}
              className="grid size-11 place-items-center rounded-full hover:bg-white/5"
              aria-label={t('close')}>
              <X className="size-5" />
            </button>
          </div>
          <ul className="mt-12 flex flex-col gap-2">
            {links.map(link => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => {
                    setMenuOpen(false)
                  }}
                  className="block py-2 text-5xl font-bold tracking-[-0.03em]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center justify-between gap-4">
            <span className="tabular flex items-center gap-2 text-sm text-muted">
              <OnlineDot online />
              {t('online', {count: networkOnline})}
            </span>
            <SettingsMenu placement="top" />
          </div>
        </div>
      )}
    </header>
  )
}

function SettingsMenu({placement = 'bottom'}: {placement?: 'top' | 'bottom'}) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const {currency, setCurrency} = useShop()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
  }, [])
  useDismiss(ref, open, close)

  const symbol = CURRENCIES.find(c => c.code === currency)?.symbol

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(v => !v)
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('settings')}
        className="flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-white/25">
        <Globe className="size-4 text-muted" />
        <span className="uppercase">{locale}</span>
        <span className="text-muted">·</span>
        <span>{symbol}</span>
        <ChevronDown
          className={`size-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 w-64 rounded-[22px] border border-border bg-surface p-2 shadow-[0_24px_48px_rgb(0_0_0/0.5)] ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}>
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
            {t('language')}
          </p>
          {routing.locales.map(code => (
            <MenuItem
              key={code}
              code={code.toUpperCase()}
              label={LANGUAGE_NAMES[code] ?? code}
              selected={code === locale}
              onSelect={() => {
                setOpen(false)
                router.replace(pathname, {locale: code, scroll: false})
              }}
            />
          ))}
          <div className="mx-3 my-2 h-px bg-line" />
          <p className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
            {t('currency')}
          </p>
          {CURRENCIES.map(c => (
            <MenuItem
              key={c.code}
              code={c.symbol}
              label={c.code}
              selected={c.code === currency}
              onSelect={() => {
                setCurrency(c.code)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  code,
  label,
  selected,
  onSelect
}: {
  code: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-white/5 ${
        selected ? 'bg-white/[0.06]' : ''
      }`}>
      <span className="w-7 text-xs font-semibold text-muted">{code}</span>
      <span className="flex-1">{label}</span>
      {selected && <Check className="size-4 text-online" />}
    </button>
  )
}

function CartButton() {
  const t = useTranslations('cart')
  const locale = useLocale()
  const {lines, count, currency, remove} = useShop()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
  }, [])
  useDismiss(ref, open, close)

  const total = lines.reduce((sum, l) => sum + l.product.price[currency] * l.qty, 0)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(v => !v)
        }}
        aria-expanded={open}
        aria-label={t('label', {count})}
        className="relative grid size-11 place-items-center rounded-full bg-fg text-ink transition-transform active:scale-95">
        <ShoppingBag className="size-[18px]" />
        {count > 0 && (
          <span className="tabular absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-on-accent">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2*var(--gutter)))] rounded-[22px] border border-border bg-surface p-4 shadow-[0_24px_48px_rgb(0_0_0/0.5)]">
          <p className="text-sm font-semibold">{t('title')}</p>
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
        </div>
      )}
    </div>
  )
}
