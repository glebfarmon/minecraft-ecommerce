'use client'

import {NavLinks} from '@/app/[locale]/_components/nav-links'
import {OnlineDot} from '@/components/online-dot'
import {CartMenu} from '@/features/cart/components/cart-menu'
import {SettingsMenu} from '@/features/settings/components/settings-menu'
import {useScrolled} from '@/hooks/use-scrolled'
import {Link, usePathname} from '@/i18n/navigation'
import {networkOnline} from '@/lib/catalog'
import {Menu, X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import type {MouseEvent} from 'react'
import {useEffect, useState} from 'react'

export function Navbar() {
  const t = useTranslations('nav')
  const [menuOpen, setMenuOpen] = useState(false)
  const scrolled = useScrolled()
  const pathname = usePathname()

  // Next.js skips navigation to the URL already shown, so links to the current page scroll up by hand.
  const scrollToTopIfCurrent = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href !== pathname) return
    event.preventDefault()
    window.scrollTo({top: 0})
  }
  // Transitions turn on two frames after mount, so a reload mid-page shows the pill without animating into it.
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setAnimate(true)
      })
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [])

  const links = [
    {href: '/', label: t('home')},
    {href: '/cases', label: t('cases')},
    {href: '/rules', label: t('rules')},
    {href: '/contacts', label: t('contacts')}
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
        data-scrolled={scrolled || undefined}
        data-animate={animate || undefined}
        className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 rounded-full border border-transparent pr-2 pl-6 data-animate:transition-[max-width,background-color,border-color,box-shadow,backdrop-filter] data-animate:duration-300 data-animate:ease-in-out data-scrolled:max-w-[1200px] data-scrolled:border-border data-scrolled:bg-surface/70 data-scrolled:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.7)] data-scrolled:backdrop-blur-md data-animate:motion-reduce:transition-[background-color,border-color,box-shadow] data-animate:motion-reduce:duration-200">
        <Link
          href="/"
          onClick={event => {
            scrollToTopIfCurrent(event, '/')
          }}
          className="font-display text-xl font-bold tracking-wide uppercase">
          Block<span className="text-accent">haus</span>
        </Link>

        <NavLinks links={links} currentPath={pathname} onLinkClick={scrollToTopIfCurrent} />

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <span className="tabular hidden items-center gap-2 px-3 text-sm text-muted sm:flex">
            <OnlineDot online />
            {t('online', {count: networkOnline})}
          </span>
          <div className="hidden sm:block">
            <SettingsMenu />
          </div>
          <CartMenu />
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
                  onClick={event => {
                    setMenuOpen(false)
                    scrollToTopIfCurrent(event, link.href)
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
            <SettingsMenu anchor="bottom-end" />
          </div>
        </div>
      )}
    </header>
  )
}
