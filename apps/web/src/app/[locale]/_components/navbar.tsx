'use client'

import {MobileMenu} from '@/app/[locale]/_components/mobile-menu'
import {NavLinks} from '@/app/[locale]/_components/nav-links'
import {PAGES, SITE_NAME} from '@/config/site'
import {CartMenu} from '@/features/cart/components/cart-menu'
import {SettingsMenu} from '@/features/settings/components/settings-menu'
import {OnlineBadge} from '@/features/status/components/online-badge'
import {useScrolled} from '@/hooks/use-scrolled'
import {Link, usePathname} from '@/i18n/navigation'
import {findServer} from '@/lib/catalog'
import {useTranslations} from 'next-intl'
import type {MouseEvent} from 'react'
import {useEffect, useState} from 'react'

export function Navbar() {
  const t = useTranslations('nav')
  const scrolled = useScrolled()
  const pathname = usePathname()
  // Home keeps the selected server (/anarchy, /anarchy/<product>), so the logo scrolls up instead of dropping it.
  const serverSlug = pathname.split('/')[1] ?? ''
  const homeHref = findServer(serverSlug) ? `/${serverSlug}` : '/'

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
    {href: homeHref, label: t('home')},
    ...(Object.keys(PAGES) as (keyof typeof PAGES)[]).map(key => ({
      href: PAGES[key],
      label: t(key)
    }))
  ]

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-[var(--gutter)] pt-4">
      <nav
        aria-label={t('main')}
        data-scrolled={scrolled || undefined}
        data-animate={animate || undefined}
        className="mx-auto flex h-16 max-w-page items-center gap-6 rounded-full border border-transparent pr-2 pl-6 data-animate:transition-[max-width,background-color,border-color,box-shadow,backdrop-filter] data-animate:duration-300 data-animate:ease-in-out data-scrolled:max-w-[1200px] data-scrolled:border-border data-scrolled:bg-surface/70 data-scrolled:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.7)] data-scrolled:backdrop-blur-md data-animate:motion-reduce:transition-[background-color,border-color,box-shadow] data-animate:motion-reduce:duration-200 xl:grid xl:grid-cols-[1fr_auto_1fr]">
        <Link
          href={homeHref}
          onClick={event => {
            scrollToTopIfCurrent(event, homeHref)
          }}
          className="justify-self-start font-display text-xl font-bold tracking-wide uppercase">
          {SITE_NAME.plain}
          <span className="text-accent">{SITE_NAME.accent}</span>
        </Link>

        <NavLinks links={links} currentPath={pathname} onLinkClick={scrollToTopIfCurrent} />

        <div className="ml-auto flex items-center gap-2 xl:ml-0 xl:justify-self-end">
          <span className="tabular hidden items-center gap-2 px-3 text-sm text-muted sm:flex">
            <OnlineBadge />
          </span>
          <div className="hidden sm:block">
            <SettingsMenu />
          </div>
          <CartMenu />
          <MobileMenu links={links} onLinkClick={scrollToTopIfCurrent} />
        </div>
      </nav>
    </header>
  )
}
